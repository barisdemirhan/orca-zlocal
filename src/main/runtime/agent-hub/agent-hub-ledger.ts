import { randomUUID } from 'node:crypto'
import type {
  AgentHubAck,
  AgentHubAnswer,
  AgentHubAskContent,
  AgentHubCaller,
  AgentHubCardOperation,
  AgentHubCardResult,
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
import { AgentHubRateLimits, agentHubCallerRateKey } from './agent-hub-rate-limits'
import { AgentHubPendingRequests } from './agent-hub-pending-requests'
import { AgentHubProgressLines } from './agent-hub-progress'
import { AgentHubOrbOperations } from './agent-hub-orb-operations'
import { AgentHubSessionConsent } from './agent-hub-session-consent'
import { AgentHubCardQuery, type AgentHubCardCommand } from './agent-hub-card-query'
import {
  AGENT_HUB_ORB_MEMORY_PROPOSAL_TTL_MS as MEMORY_TTL_MS,
  AgentHubOrbMemoryProposals
} from './agent-hub-orb-memory-proposals'
import { answerAgentHubAskWhenAway } from './agent-hub-away-answer'

type AgentHubQueryBody =
  | { kind: 'presence' }
  | { kind: 'status' }
  | { kind: 'card'; card: AgentHubCardOperation }

export class AgentHubLedger {
  readonly orbOperations: AgentHubOrbOperations
  private readonly desktops = new Map<string, number>()
  private readonly consent: AgentHubSessionConsent
  private readonly rates: AgentHubRateLimits
  /** Read by the CLI answer path, which settles asks without a subscribed desktop. */
  readonly requests: AgentHubPendingRequests
  private readonly progress: AgentHubProgressLines
  private readonly memories: AgentHubOrbMemoryProposals
  private readonly cards = new AgentHubCardQuery()

  constructor(
    publish: (event: AgentHubEvent) => void,
    private readonly now: () => number = Date.now,
    parentOf: (paneKey: string) => string | undefined = () => undefined
  ) {
    this.consent = new AgentHubSessionConsent(parentOf)
    this.rates = new AgentHubRateLimits(now)
    this.requests = new AgentHubPendingRequests(now, publish)
    this.memories = new AgentHubOrbMemoryProposals(this.requests)
    this.progress = new AgentHubProgressLines(now, publish)
    this.orbOperations = new AgentHubOrbOperations(publish)
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
        this.requests.unregisterDesktop(desktop)
      }
    }
  }

  snapshot(): AgentHubSnapshot {
    return {
      requests: this.requests.snapshot(),
      progress: [...this.progress.snapshot(), ...this.orbOperations.snapshot()]
    }
  }

  notify(
    caller: AgentHubCaller,
    target: AgentHubPane,
    content: { text: string; level: 'info' | 'done' | 'needs-you'; sound: boolean; links: string[] }
  ): { requestId: string } {
    this.requireDesktop()
    this.rates.consume(caller, 'notify')
    const request: AgentHubRequest = {
      ...this.base(caller, target, 600_000),
      ...(content.level === 'needs-you' ? { expiresAt: Number.MAX_SAFE_INTEGER } : {}),
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
    const pending = this.requests.pendingAsks(agentHubCallerRateKey(caller))
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
      void answerAgentHubAskWhenAway(
        request,
        () => this.presence(caller, target),
        (answer) => this.requests.respond(requestId, answer, 'host', 'away-default')
      )
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
    if (
      !request ||
      request.kind !== 'ask' ||
      agentHubCallerRateKey(request.caller) !== agentHubCallerRateKey(caller)
    ) {
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
    const response = await this.query(caller, target, { kind: 'presence' }, signal)
    if (response.kind !== 'presence') {
      throw new AgentHubError('invalid_argument', 'Invalid presence response')
    }
    return { present: response.present, idleMinutes: response.idleMinutes }
  }

  clearProgress(paneKey: string): void {
    this.progress.clear(paneKey)
  }

  async status(
    caller: AgentHubCaller,
    target: AgentHubPane,
    signal?: AbortSignal
  ): Promise<AgentHubStatus> {
    const response = await this.query(caller, target, { kind: 'status' }, signal)
    if (response.kind !== 'status') {
      throw new AgentHubError('invalid_argument', 'Invalid status response')
    }
    const { kind: _kind, ...status } = response
    return status
  }

  async card(
    caller: AgentHubCaller,
    target: AgentHubPane,
    command: AgentHubCardCommand,
    signal?: AbortSignal
  ): Promise<AgentHubCardResult> {
    return this.cards.run(caller, command, (card) =>
      this.query(caller, target, { kind: 'card', card }, signal)
    )
  }

  async operate(
    caller: AgentHubCaller,
    target: AgentHubPane,
    operation: AgentHubOperation,
    signal?: AbortSignal
  ): Promise<{ requestId: string } & AgentHubAck> {
    this.requireDesktop()
    this.rates.consume(caller, operation.kind.startsWith('peek') ? 'peek' : 'mirror')
    if (this.consent.needed(caller, target)) {
      const base = this.base(caller, target, 600_000)
      const { response } = await this.send({ ...base, kind: 'consent', operation }, signal)
      this.consent.accept(caller, target, response)
    }
    if (signal?.aborted) {
      throw new AgentHubError('connection_lost', 'Hub caller disconnected before the operation')
    }
    this.requireDesktop()
    const request: AgentHubRequest = { ...this.base(caller, target), ...operation }
    const execute = async (operationSignal?: AbortSignal) => {
      const { response } = await this.send(request, operationSignal)
      const ack = response.kind === 'ack' ? { mirror: response.mirror, peek: response.peek } : {}
      return { requestId: request.requestId, ...ack }
    }
    return caller.kind === 'orb' && caller.sessionId
      ? this.orbOperations.run(
          caller.sessionId,
          { kind: 'pane', ...target },
          `agentHub.${operation.kind}`,
          execute,
          signal
        )
      : execute(signal)
  }

  proposeMemory(caller: AgentHubCaller, target: AgentHubPane, text: string): { requestId: string } {
    this.requireDesktop()
    const request = this.memories.propose(this.base(caller, target, MEMORY_TTL_MS), text)
    this.requests.create(request, this.desktops.keys())
    return { requestId: request.requestId }
  }

  pendingMemoryText(requestId: string): string | undefined {
    return this.memories.pendingText(requestId)
  }

  respond(
    requestId: string,
    response: AgentHubResponse,
    desktop: string
  ): { accepted: true; requestId: string } {
    if (!this.desktops.has(desktop)) {
      throw new AgentHubError('no_desktop', 'Only a subscribed desktop can respond to hub requests')
    }
    this.memories.settle(requestId, response, () =>
      this.requests.respond(requestId, response, desktop)
    )
    return { accepted: true, requestId }
  }

  dispose(): void {
    this.orbOperations.dispose()
    this.progress.dispose()
    this.requests.dispose()
    this.desktops.clear()
    this.consent.clear()
  }

  private base(
    caller: AgentHubCaller,
    target: AgentHubPane,
    timeoutMs = AGENT_HUB_UI_TIMEOUT_MS
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
    body: AgentHubQueryBody,
    signal?: AbortSignal
  ): Promise<AgentHubResponse> {
    this.requireDesktop()
    this.rates.consume(caller, 'query')
    return (await this.send({ ...this.base(caller, target), ...body }, signal)).response
  }
  private send(request: AgentHubRequest, signal?: AbortSignal) {
    this.requests.create(request, this.desktops.keys())
    return this.requests.wait(request.requestId, signal)
  }
}
