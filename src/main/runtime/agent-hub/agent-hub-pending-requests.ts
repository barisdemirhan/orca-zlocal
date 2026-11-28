import type {
  AgentHubAnswer,
  AgentHubClosed,
  AgentHubEvent,
  AgentHubRequest,
  AgentHubResponse
} from '../../../shared/agent-hub-requests'
import { AgentHubError } from './agent-hub-error'
import { agentHubCallerRateKey } from './agent-hub-rate-limits'

export type AgentHubSettlement = {
  response: AgentHubResponse
  desktop: string
  by?: AgentHubAnswer['by']
}
type Outcome = { value: AgentHubSettlement } | { error: AgentHubError }
type Entry = {
  request: AgentHubRequest
  timer?: ReturnType<typeof setTimeout>
  outcome?: Outcome
  /** A waiting caller took the settled outcome, at once or on resume. */
  collected?: boolean
  listeners: Set<(outcome: Outcome) => void>
  desktops: Set<string>
  presence: Map<string, Extract<AgentHubResponse, { kind: 'presence' }>>
}

export class AgentHubPendingRequests {
  private readonly entries = new Map<string, Entry>()
  constructor(
    private readonly now: () => number,
    private readonly publish: (event: AgentHubEvent) => void
  ) {}

  get(requestId: string): AgentHubRequest | undefined {
    return this.entries.get(requestId)?.request
  }
  pendingAsks(paneKey: string): AgentHubRequest[] {
    return this.snapshot().filter(
      (request) => request.kind === 'ask' && agentHubCallerRateKey(request.caller) === paneKey
    )
  }
  /** Whether the asker's wait has taken the settled answer; null while unsettled or unknown. */
  collected(requestId: string): boolean | null {
    const entry = this.entries.get(requestId)
    return entry?.outcome ? entry.collected === true : null
  }
  snapshot(): AgentHubRequest[] {
    return [...this.entries.values()]
      .filter((entry) => !entry.outcome)
      .map((entry) => entry.request)
  }

  create(request: AgentHubRequest, desktops: Iterable<string>): void {
    const timer =
      request.kind === 'notify' && request.level === 'needs-you'
        ? undefined
        : setTimeout(
            () => this.expire(request.requestId),
            Math.max(0, request.expiresAt - this.now())
          )
    timer?.unref?.()
    this.entries.set(request.requestId, {
      request,
      timer,
      listeners: new Set(),
      desktops: new Set(desktops),
      presence: new Map()
    })
    this.publish(request)
  }

  unregisterDesktop(desktop: string): void {
    for (const entry of this.entries.values()) {
      if (entry.outcome || entry.request.kind !== 'presence' || !entry.desktops.delete(desktop)) {
        continue
      }
      entry.presence.delete(desktop)
      this.settlePresence(entry)
    }
  }

  wait(requestId: string, signal?: AbortSignal): Promise<AgentHubSettlement> {
    const entry = this.entries.get(requestId)
    if (!entry) {
      return Promise.reject(
        new AgentHubError(
          'request_not_found',
          'Hub question was not found; the host may have restarted'
        )
      )
    }
    return new Promise((resolve, reject) => {
      const finish = (outcome: Outcome): void => {
        entry.listeners.delete(finish)
        signal?.removeEventListener('abort', onAbort)
        if ('error' in outcome) {
          reject(outcome.error)
        } else {
          resolve(outcome.value)
        }
      }
      const onAbort = (): void =>
        finish({
          error: new AgentHubError(
            'connection_lost',
            'Hub connection closed; resume this question instead of creating another',
            { requestId }
          )
        })
      if (entry.outcome) {
        entry.collected = true
        finish(entry.outcome)
        return
      }
      if (signal?.aborted) {
        onAbort()
        return
      }
      entry.listeners.add(finish)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  respond(
    requestId: string,
    response: AgentHubResponse,
    desktop: string,
    by: AgentHubAnswer['by'] = 'human'
  ): void {
    const entry = this.entries.get(requestId)
    if (!entry) {
      throw new AgentHubError('request_not_found', 'Hub request was not found')
    }
    if (entry.outcome) {
      throw new AgentHubError(
        'already_resolved',
        'Another desktop already resolved this hub request'
      )
    }
    if (this.now() >= entry.request.expiresAt) {
      this.expire(requestId)
      throw new AgentHubError('already_resolved', 'Hub request has expired')
    }
    if (response.kind === 'error') {
      this.finish(entry, { error: new AgentHubError(response.code, response.message) })
      return
    }
    const request = entry.request
    if (request.kind === 'ask' && response.kind === 'ask') {
      const indices = response.indices ?? (response.index === null ? [] : [response.index])
      if (
        indices.some((index) => index > request.options.length) ||
        new Set(indices).size !== indices.length ||
        (!request.multi && (response.indices !== undefined || indices.length > 1)) ||
        (response.index !== null && !indices.includes(response.index))
      ) {
        throw new AgentHubError('invalid_argument', 'Answer indices must name the question options')
      }
    } else if (request.kind === 'memory') {
      if (response.kind !== 'memory') {
        throw new AgentHubError('invalid_argument', 'Response kind does not match the hub request')
      }
    } else if (request.kind === 'presence' && response.kind === 'presence') {
      if (!entry.desktops.has(desktop)) {
        throw new AgentHubError('invalid_argument', 'Desktop did not receive this presence request')
      }
      if (entry.presence.has(desktop)) {
        throw new AgentHubError('already_resolved', 'This desktop already reported presence')
      }
      entry.presence.set(desktop, response)
      this.settlePresence(entry)
      return
    } else if (
      (request.kind === 'consent' && response.kind !== 'consent') ||
      (request.kind === 'status' && response.kind !== 'status') ||
      (request.kind !== 'ask' &&
        request.kind !== 'presence' &&
        request.kind !== 'consent' &&
        request.kind !== 'status' &&
        response.kind !== 'ack') ||
      request.kind === 'ask' ||
      request.kind === 'presence'
    ) {
      throw new AgentHubError('invalid_argument', 'Response kind does not match the hub request')
    }
    this.finish(entry, { value: { response, desktop, by } })
  }

  private settlePresence(entry: Entry): void {
    if (!entry.desktops.size) {
      this.finish(entry, { error: new AgentHubError('no_desktop', 'No connected desktop remains') })
      return
    }
    const replies = [...entry.presence.entries()]
    const present = replies.find(([, response]) => response.present)
    if (!present && replies.length < entry.desktops.size) {
      return
    }
    const reply = present ?? replies[0]
    if (!reply) {
      return
    }
    this.finish(entry, {
      value: {
        response: {
          ...reply[1],
          idleMinutes: Math.min(...replies.map(([, response]) => response.idleMinutes))
        },
        desktop: reply[0]
      }
    })
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      if (!entry.outcome) {
        this.finish(entry, { error: new AgentHubError('connection_lost', 'Hub host stopped') })
      }
      clearTimeout(entry.timer)
    }
    this.entries.clear()
  }

  private expire(requestId: string): void {
    const entry = this.entries.get(requestId)
    if (!entry || entry.outcome) {
      return
    }
    const request = entry.request
    if (request.kind === 'ask' && request.ifAway && request.recommended) {
      this.finish(entry, {
        value: {
          response: {
            kind: 'ask',
            answer: request.options[request.recommended - 1],
            index: request.recommended
          },
          desktop: 'host',
          by: 'timeout'
        }
      })
    } else {
      const code = request.kind === 'ask' ? 'timeout' : 'no_response'
      this.finish(entry, {
        error: new AgentHubError(
          code,
          request.kind === 'ask' ? 'Hub question timed out' : 'No desktop answered the hub request',
          { requestId }
        )
      })
    }
  }

  private finish(entry: Entry, outcome: Outcome): void {
    if (entry.outcome) {
      return
    }
    entry.outcome = outcome
    clearTimeout(entry.timer)
    const event: AgentHubClosed = {
      ...entry.request,
      kind: 'closed',
      reason: 'error' in outcome ? outcome.error.code : 'responded'
    }
    if ('value' in outcome && outcome.value.response.kind === 'ask') {
      const { kind: _kind, ...answer } = outcome.value.response
      event.result = { ...answer, by: outcome.value.by ?? 'human', desktop: outcome.value.desktop }
    }
    this.publish(event)
    entry.collected = entry.listeners.size > 0
    for (const listener of entry.listeners) {
      listener(outcome)
    }
    const completed = [...this.entries.values()].filter((value) => value.outcome)
    for (const stale of completed.slice(0, Math.max(0, completed.length - 512))) {
      this.entries.delete(stale.request.requestId)
    }
  }
}
