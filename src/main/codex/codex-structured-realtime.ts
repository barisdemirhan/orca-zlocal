import type {
  AgentSessionVoiceEvent,
  AgentSessionVoiceOwner,
  AgentSessionVoiceResult
} from '../../shared/agent-session-voice'
import { isAgentSessionVoiceSdp } from '../../shared/agent-session-voice'
import { isCodexAppServerRequestError } from './app-server/codex-app-server-request-error'
import type { CodexAppServerConnection } from './app-server/codex-app-server-connection-types'
import { readCodexRealtimeSupport } from './codex-structured-realtime-support'
import { CodexAppServerUnsupportedError } from './app-server/codex-app-server-session'

type VoiceAttempt = AgentSessionVoiceOwner & {
  state: 'connecting' | 'live' | 'stopping' | 'unverifiable' | 'off'
  started: boolean
  items: Map<string, 'user' | 'assistant'>
}

export type CodexVoiceStartOutcome =
  | { ok: true; value: AgentSessionVoiceResult }
  | { ok: false; rejected: string }

export function codexVoiceFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (
    error instanceof CodexAppServerUnsupportedError ||
    (isCodexAppServerRequestError(error) && error.code === -32601)
  ) {
    return 'This Codex version does not support Live voice.'
  }
  if (/quota|rate.limit|usage.limit|budget|credits/i.test(message)) {
    return 'Codex Live voice is unavailable because an account usage limit was reached.'
  }
  if (/unauthori|authenticat|sign.in|log.in|account|entitle|permission|workspace/i.test(message)) {
    return 'Codex refused Live voice. Check the current account and workspace access.'
  }
  return 'Codex Live voice could not connect. Try again after the connection has closed.'
}

function isUnknownRealtimeVersion(error: unknown): boolean {
  return isCodexAppServerRequestError(error) && /unknown variant `v3`/.test(error.message)
}

/** One voice attempt at a time on the conversation's existing provider connection. */
export class CodexStructuredRealtime {
  private attempt: VoiceAttempt | undefined
  private readonly spent = new Set<string>()

  constructor(
    private readonly connection: Pick<CodexAppServerConnection, 'request'>,
    private readonly sessionId: string,
    private readonly threadId: string,
    private readonly emit: (event: AgentSessionVoiceEvent) => void,
    private readonly timeoutMs = 15_000
  ) {}

  get holdsWork(): boolean {
    return this.attempt !== undefined && this.attempt.state !== 'off'
  }

  async start(input: AgentSessionVoiceOwner & { sdp: string }): Promise<CodexVoiceStartOutcome> {
    if (!isAgentSessionVoiceSdp(input.sdp)) {
      return { ok: false, rejected: 'Invalid voice SDP offer.' }
    }
    if (this.attempt?.state === 'unverifiable') {
      await this.stop(this.attempt)
    }
    if (this.holdsWork) {
      return {
        ok: false,
        rejected: 'Codex Live voice is still closing. Try again shortly.'
      }
    }
    if (this.spent.has(input.voiceSessionId)) {
      return {
        ok: false,
        rejected: 'This voice attempt cannot be replayed. Start a new Live attempt.'
      }
    }
    const support = await readCodexRealtimeSupport(this.connection, this.timeoutMs)
    if (support.supported !== true) {
      return { ok: false, rejected: support.reason }
    }
    // A concurrent direct adapter call may have started while the read was in flight.
    if (this.holdsWork || this.spent.has(input.voiceSessionId)) {
      return {
        ok: false,
        rejected: 'Codex Live voice is still closing. Try again shortly.'
      }
    }
    this.spent.add(input.voiceSessionId)
    while (this.spent.size > 1024) {
      this.spent.delete(this.spent.values().next().value ?? '')
    }
    const attempt: VoiceAttempt = {
      voiceSessionId: input.voiceSessionId,
      generation: input.generation,
      state: 'connecting',
      started: false,
      items: new Map()
    }
    this.attempt = attempt
    const params = {
      threadId: this.threadId,
      realtimeSessionId: input.voiceSessionId,
      outputModality: 'audio',
      transport: { type: 'webrtc', sdp: input.sdp }
    }
    try {
      try {
        // Why: codex-cli 0.163 WebRTC calls fail on its v1 default ("AVAS requires OpenAI-Alpha") and v2.
        await this.connection.request(
          'thread/realtime/start',
          { ...params, version: 'v3' },
          { timeoutMs: this.timeoutMs }
        )
      } catch (error) {
        if (!isUnknownRealtimeVersion(error) || attempt.started) {
          throw error
        }
        await this.connection.request('thread/realtime/start', params, {
          timeoutMs: this.timeoutMs
        })
      }
    } catch (error) {
      if (
        (isCodexAppServerRequestError(error) || error instanceof CodexAppServerUnsupportedError) &&
        !attempt.started
      ) {
        attempt.state = 'off'
        return { ok: false, rejected: codexVoiceFailureMessage(error) }
      } else if (attempt.state !== 'off') {
        attempt.state = 'unverifiable'
      }
      // Provider diagnostics may echo signalling. Only fixed, readable categories leave here.
      throw new Error(codexVoiceFailureMessage(error))
    }
    return { ok: true, value: this.result(attempt, 'connecting') }
  }

  async appendText(input: AgentSessionVoiceOwner & { text: string }): Promise<boolean> {
    const attempt = this.attempt
    if (
      !attempt ||
      !this.matches(input, attempt) ||
      attempt.state !== 'live' ||
      !attempt.started ||
      !input.text.trim() ||
      input.text.length > 8192
    ) {
      return false
    }
    try {
      await this.connection.request(
        'thread/realtime/appendText',
        {
          threadId: this.threadId,
          text: input.text,
          role: 'user'
        },
        { timeoutMs: this.timeoutMs }
      )
      return this.attempt === attempt && attempt.state === 'live'
    } catch {
      return false
    }
  }

  async stop(owner: AgentSessionVoiceOwner): Promise<AgentSessionVoiceResult> {
    const attempt = this.attempt
    if (!attempt || !this.matches(owner, attempt) || attempt.state === 'off') {
      return this.result(owner, 'off')
    }
    attempt.state = 'stopping'
    try {
      await this.connection.request(
        'thread/realtime/stop',
        { threadId: this.threadId },
        { timeoutMs: this.timeoutMs }
      )
      this.closeAttempt(attempt, 'Codex Live voice closed.')
    } catch {
      // A lost stop acknowledgement does not prove the voice transport closed.
    }
    if (!this.isOff(attempt)) {
      attempt.state = 'unverifiable'
    }
    return this.result(attempt, this.isOff(attempt) ? 'off' : 'unverifiable')
  }

  observe(method: string, params: Record<string, unknown>): void {
    const attempt = this.attempt
    if (!attempt || attempt.state === 'off' || params.threadId !== this.threadId) {
      return
    }
    const base = {
      sessionId: this.sessionId,
      voiceSessionId: attempt.voiceSessionId,
      generation: attempt.generation
    }
    if (method === 'thread/realtime/closed') {
      this.closeAttempt(attempt, 'Codex Live voice closed.')
    } else if (method === 'thread/realtime/started') {
      // Untagged startup cannot establish which offer owns later untagged SDP.
      if (params.realtimeSessionId !== attempt.voiceSessionId) {
        return
      }
      attempt.started = true
      if (attempt.state === 'connecting') {
        attempt.state = 'live'
        this.emit({ ...base, type: 'started' })
      }
    } else if (method === 'thread/realtime/sdp') {
      if (attempt.started && attempt.state === 'live' && isAgentSessionVoiceSdp(params.sdp)) {
        this.emit({ ...base, type: 'sdp', sdp: params.sdp })
      }
    } else if (method === 'thread/realtime/error') {
      if (attempt.state !== 'stopping') {
        attempt.state = 'unverifiable'
      }
      this.emit({ ...base, type: 'error', message: codexVoiceFailureMessage(params.message) })
    } else if (attempt.started && attempt.state === 'live') {
      this.transcript(attempt, base, method, params)
    }
  }

  private transcript(
    attempt: VoiceAttempt,
    base: AgentSessionVoiceOwner & { sessionId: string },
    method: string,
    params: Record<string, unknown>
  ): void {
    if (method === 'thread/realtime/item/transcript/delta') {
      const itemId = params.itemId
      const role = typeof itemId === 'string' ? attempt.items.get(itemId) : undefined
      if (role && typeof itemId === 'string' && typeof params.delta === 'string') {
        this.emit({
          ...base,
          type: 'transcript',
          role,
          phase: 'delta',
          itemId,
          hasText: params.delta.trim().length > 0,
          ...(role === 'assistant' ? { text: params.delta.slice(0, 8192) } : {})
        })
      }
      return
    }
    if (method !== 'thread/realtime/item/started' && method !== 'thread/realtime/item/completed') {
      return
    }
    const item = params.item
    if (
      typeof item !== 'object' ||
      item === null ||
      !('type' in item) ||
      item.type !== 'transcriptSegment' ||
      !('id' in item) ||
      typeof item.id !== 'string' ||
      !('role' in item) ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      !('realtimeSessionId' in item) ||
      item.realtimeSessionId !== attempt.voiceSessionId
    ) {
      return
    }
    const phase = method === 'thread/realtime/item/started' ? 'started' : 'done'
    if (phase === 'started') {
      if (attempt.items.size >= 128) {
        attempt.items.delete(attempt.items.keys().next().value ?? '')
      }
      attempt.items.set(item.id, item.role)
    } else {
      attempt.items.delete(item.id)
    }
    this.emit({
      ...base,
      type: 'transcript',
      role: item.role,
      phase,
      itemId: item.id,
      hasText: 'text' in item && typeof item.text === 'string' && item.text.trim().length > 0,
      ...(item.role === 'assistant' && 'text' in item && typeof item.text === 'string'
        ? { text: item.text.slice(0, 8192) }
        : {})
    })
  }

  ended(): void {
    const attempt = this.attempt
    if (attempt) {
      this.closeAttempt(attempt, 'The Codex provider connection ended.')
    }
  }

  private closeAttempt(attempt: VoiceAttempt, reason: string): void {
    if (attempt.state === 'off') {
      return
    }
    attempt.state = 'off'
    this.emit({
      sessionId: this.sessionId,
      voiceSessionId: attempt.voiceSessionId,
      generation: attempt.generation,
      type: 'closed',
      reason
    })
  }

  private matches(left: AgentSessionVoiceOwner, right: AgentSessionVoiceOwner): boolean {
    return left.voiceSessionId === right.voiceSessionId && left.generation === right.generation
  }

  private isOff(attempt: VoiceAttempt): boolean {
    return attempt.state === 'off'
  }

  private result(
    owner: AgentSessionVoiceOwner,
    state: AgentSessionVoiceResult['state']
  ): AgentSessionVoiceResult {
    return { voiceSessionId: owner.voiceSessionId, generation: owner.generation, state }
  }
}
