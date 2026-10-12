import { randomUUID } from 'node:crypto'
import type {
  AgentHubAnswer,
  AgentHubAskContent,
  AgentHubCaller,
  AgentHubEvent,
  AgentHubOperation,
  AgentHubPane,
  AgentHubPresence,
  AgentHubRequest,
  AgentHubRequestBase,
  AgentHubResponse,
  AgentHubSnapshot,
  AgentHubStatus
} from '../../../shared/agent-hub-requests'
import { AGENT_HUB_UI_TIMEOUT_MS } from '../../../shared/rpc-contract/agent-hub-params'
import { AgentHubError } from './agent-hub-error'
import { AgentHubRateLimits } from './agent-hub-rate-limits'
import { AgentHubPendingRequests } from './agent-hub-pending-requests'
import { AgentHubProgressLines } from './agent-hub-progress'

/** Descendant authority is added here when the host owns pane lineage. */
export function agentHubTargetNeedsConsent(caller: AgentHubCaller, target: AgentHubPane): boolean {
  return caller.paneKey !== target.paneKey
}

export class AgentHubLedger {
  private readonly desktops = new Map<string, number>()
  private readonly sessionGrants = new Set<string>()
  private readonly rates: AgentHubRateLimits
  private readonly requests: AgentHubPendingRequests
  private readonly progress: AgentHubProgressLines

  constructor(
    publish: (event: AgentHubEvent) => void,
    private readonly now: () => number = Date.now
  ) {
    this.rates = new AgentHubRateLimits(now)
    this.requests = new AgentHubPendingRequests(now, publish)
    this.progress = new AgentHubProgressLines(now, publish)
  }

  registerDesktop(desktop: string): () => void {
    this.desktops.set(desktop, (this.desktops.get(desktop) ?? 0) + 1)
    let active = true
    return () => {
      if (!active) {
        return
      }
      active = false
      const count = (this.desktops.get(desktop) ?? 1) - 1
      if (count > 0) {
        this.desktops.set(desktop, count)
      } else {
        this.desktops.delete(desktop)
      }
    }
  }

  snapshot(): AgentHubSnapshot {
    return { requests: this.requests.snapshot(), progress: this.progress.snapshot() }
  }

  notify(
    caller: AgentHubCaller,
    target: AgentHubPane,
    content: { text: string; level: 'info' | 'done' | 'needs-you'; sound: boolean; links: string[] }
  ): { requestId: string } {
    this.requireDesktop()
    this.rates.consume(caller.paneKey, 'notify')
    const request: AgentHubRequest = {
      ...this.base(caller, target, 600_000),
      kind: 'notify',
      ...content
    }
    this.requests.create(request, this.desktops.keys())
    return { requestId: request.requestId }
  }

  async ask(
    caller: AgentHubCaller,
    target: AgentHubPane,
    content: AgentHubAskContent,
    timeoutMs: number,
    requestId: string = randomUUID(),
    signal?: AbortSignal
  ): Promise<AgentHubAnswer & { requestId: string }> {
    this.requireDesktop()
    if (this.requests.get(requestId)) {
      throw new AgentHubError('invalid_argument', 'Question ID already exists; use --resume')
    }
    const pending = this.requests.pendingAsks(caller.paneKey)
    if (pending.length >= 3) {
      throw new AgentHubError(
        'rate_limited',
        'At most three hub questions may be pending per pane',
        {
          retryAfterMs: Math.max(
            1,
            Math.min(...pending.map((request) => request.expiresAt)) - this.now()
          )
        }
      )
    }
    const request: AgentHubRequest = {
      ...this.base(caller, target, timeoutMs),
      requestId,
      kind: 'ask',
      ...content
    }
    this.requests.create(request, this.desktops.keys())
    if (content.ifAway) {
      void this.answerWhenAway(request)
    }
    return this.resume(caller, requestId, signal)
  }

  async resume(
    caller: AgentHubCaller,
    requestId: string,
    signal?: AbortSignal
  ): Promise<AgentHubAnswer & { requestId: string }> {
    this.requireDesktop()
    const request = this.requests.get(requestId)
    if (!request || request.kind !== 'ask' || request.caller.paneKey !== caller.paneKey) {
      throw new AgentHubError(
        'request_not_found',
        'Question does not belong to this pane or the host has restarted'
      )
    }
    const settlement = await this.requests.wait(requestId, signal)
    if (settlement.response.kind !== 'ask') {
      throw new AgentHubError('invalid_argument', 'Invalid question response')
    }
    const { kind: _kind, ...answer } = settlement.response
    return { ...answer, requestId, by: settlement.by ?? 'human', desktop: settlement.desktop }
  }

  updateProgress(
    caller: AgentHubCaller,
    target: AgentHubPane,
    text: string | null
  ): { updated: true } {
    this.requireDesktop()
    if (text !== null && (text.length === 0 || text.length > 80)) {
      throw new AgentHubError('invalid_argument', 'Progress must have 1–80 characters')
    }
    this.progress.update(caller, target, text)
    return { updated: true }
  }

  async presence(
    caller: AgentHubCaller,
    target: AgentHubPane,
    signal?: AbortSignal
  ): Promise<AgentHubPresence> {
    const response = await this.query(caller, target, 'presence', signal)
    if (response.kind !== 'presence') {
      throw new AgentHubError('invalid_argument', 'Invalid presence response')
    }
    return { present: response.present, idleMinutes: response.idleMinutes }
  }

  async status(
    caller: AgentHubCaller,
    target: AgentHubPane,
    signal?: AbortSignal
  ): Promise<AgentHubStatus> {
    const response = await this.query(caller, target, 'status', signal)
    if (response.kind !== 'status') {
      throw new AgentHubError('invalid_argument', 'Invalid status response')
    }
    return { mirrors: response.mirrors, parked: response.parked, waiting: response.waiting }
  }

  async operate(
    caller: AgentHubCaller,
    target: AgentHubPane,
    operation: AgentHubOperation,
    signal?: AbortSignal
  ): Promise<{ requestId: string }> {
    this.requireDesktop()
    this.rates.consume(caller.paneKey, operation.kind === 'peek' ? 'peek' : 'mirror')
    const grantKey = JSON.stringify([caller.paneKey, target.paneKey])
    if (agentHubTargetNeedsConsent(caller, target) && !this.sessionGrants.has(grantKey)) {
      const consent: AgentHubRequest = {
        ...this.base(caller, target, AGENT_HUB_UI_TIMEOUT_MS),
        kind: 'consent',
        operation
      }
      this.requests.create(consent, this.desktops.keys())
      const { response } = await this.requests.wait(consent.requestId, signal)
      if (response.kind !== 'consent') {
        throw new AgentHubError('invalid_argument', 'Invalid consent response')
      }
      if (response.decision === 'deny') {
        throw new AgentHubError('denied_by_user', 'The user denied access to another pane')
      }
      if (response.decision === 'session') {
        this.sessionGrants.add(grantKey)
      }
    }
    if (signal?.aborted) {
      throw new AgentHubError('connection_lost', 'Hub caller disconnected before the operation')
    }
    this.requireDesktop()
    const request: AgentHubRequest = {
      ...this.base(caller, target, AGENT_HUB_UI_TIMEOUT_MS),
      ...operation
    }
    this.requests.create(request, this.desktops.keys())
    await this.requests.wait(request.requestId, signal)
    return { requestId: request.requestId }
  }

  respond(
    requestId: string,
    response: AgentHubResponse,
    desktop: string
  ): { accepted: true; requestId: string } {
    if (!this.desktops.has(desktop)) {
      throw new AgentHubError('no_desktop', 'Only a subscribed desktop can respond to hub requests')
    }
    this.requests.respond(requestId, response, desktop)
    return { accepted: true, requestId }
  }

  dispose(): void {
    this.progress.dispose()
    this.requests.dispose()
    this.desktops.clear()
    this.sessionGrants.clear()
  }

  private base(
    caller: AgentHubCaller,
    target: AgentHubPane,
    timeoutMs: number
  ): AgentHubRequestBase {
    const createdAt = this.now()
    return { requestId: randomUUID(), caller, target, createdAt, expiresAt: createdAt + timeoutMs }
  }
  private requireDesktop(): void {
    if (this.desktops.size === 0) {
      throw new AgentHubError('no_desktop', 'No connected desktop has Agent Hub requests enabled')
    }
  }
  private async query(
    caller: AgentHubCaller,
    target: AgentHubPane,
    kind: 'presence' | 'status',
    signal?: AbortSignal
  ): Promise<AgentHubResponse> {
    this.requireDesktop()
    const request: AgentHubRequest = { ...this.base(caller, target, AGENT_HUB_UI_TIMEOUT_MS), kind }
    this.requests.create(request, this.desktops.keys())
    return (await this.requests.wait(request.requestId, signal)).response
  }
  private async answerWhenAway(request: Extract<AgentHubRequest, { kind: 'ask' }>): Promise<void> {
    try {
      const presence = await this.presence(request.caller, request.target)
      if (!presence.present && request.recommended) {
        this.requests.respond(
          request.requestId,
          {
            kind: 'ask',
            answer: request.options[request.recommended - 1],
            index: request.recommended
          },
          'host',
          'away-default'
        )
      }
    } catch {
      // A missing presence reply leaves the question for the human or its deadline.
    }
  }
}
