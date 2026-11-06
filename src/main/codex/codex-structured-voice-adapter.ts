import type { StructuredAgentSessionVoiceAdapter } from '../native-chat/agent-session-wire/structured-agent-session-voice-adapter'
import { CodexStructuredRealtime } from './codex-structured-realtime'
import { readCodexRealtimeSupport } from './codex-structured-realtime-support'
import { readCodexRealtimeTimeline } from './codex-structured-realtime-timeline'
import {
  requireLiveCodexSession,
  type CodexSession,
  type CodexStructuredSessionAdapterDeps,
  type CodexStructuredSessionEvent
} from './structured/session-lifecycle/codex-structured-session-state'
import type { CodexJournalTranslationAdmission } from './structured/journal/codex-structured-journal-contracts'
import { isProviderRecord } from '../provider-process/provider-json-record'

// The template literal keeps other notifications in the caller's false branch.
type CodexRealtimeEvent = Extract<CodexStructuredSessionEvent, { type: 'notification' }> & {
  method: `thread/realtime/${string}`
}

export class CodexStructuredVoiceAdapter implements StructuredAgentSessionVoiceAdapter {
  constructor(
    private readonly sessions: Map<string, CodexSession>,
    private readonly dependencies: () => CodexStructuredSessionAdapterDeps
  ) {}

  private get deps(): CodexStructuredSessionAdapterDeps {
    return this.dependencies()
  }

  start: StructuredAgentSessionVoiceAdapter['start'] = async (input) => {
    const session = requireLiveCodexSession(this.sessions, input.sessionId)
    if (session.fence !== input.fence) {
      return { ok: false, rejected: 'This chat changed owner. Reopen it before starting Live.' }
    }
    const support = await this.capability(input.sessionId)
    if (support.supported !== true) {
      return { ok: false, rejected: support.reason }
    }
    if (this.sessions.get(input.sessionId) !== session || session.ended) {
      return { ok: false, rejected: 'This chat changed owner. Reopen it before starting Live.' }
    }
    if (!session.realtimeTimelineReady && !session.realtimeTimelineUnsupported) {
      const timeline = await readCodexRealtimeTimeline(
        session.connection,
        session.threadId,
        this.deps.requestTimeoutMs
      )
      if (this.sessions.get(input.sessionId) !== session || session.ended) {
        return { ok: false, rejected: 'This chat changed owner. Reopen it before starting Live.' }
      }
      if (timeline.status === 'unsupported') {
        // Live uses the acquired thread; an optional history API may be advertised but unimplemented.
        session.realtimeTimelineUnsupported = true
      } else if (timeline.status !== 'ready') {
        return {
          ok: false,
          rejected:
            timeline.status === 'limit'
              ? 'This conversation is too long for Live voice. Start a new Orb conversation.'
              : 'Codex Live history could not be verified. Try again.'
        }
      } else {
        const admission = session.translator?.restoreTimeline?.(
          session.threadId,
          timeline.entries,
          true
        )
        if (admission && !admission.accepted) {
          return { ok: false, rejected: 'Codex Live history could not be restored. Try again.' }
        }
        session.realtimeTimelineReady = true
      }
    }
    session.realtime ??= new CodexStructuredRealtime(
      session.connection,
      input.sessionId,
      session.threadId,
      (event) => {
        if (this.sessions.get(input.sessionId) === session && !session.ended) {
          this.deps.onEvent?.({
            type: 'voice',
            sessionId: input.sessionId,
            fence: session.fence,
            acquisitionGeneration: session.acquisitionGeneration,
            event
          })
        }
      },
      this.deps.requestTimeoutMs
    )
    return session.realtime.start(input)
  }

  stop: StructuredAgentSessionVoiceAdapter['stop'] = (input) => {
    const session = this.sessions.get(input.sessionId)
    if (!session || session.ended || session.fence !== input.fence || !session.realtime) {
      return Promise.resolve({
        voiceSessionId: input.voiceSessionId,
        generation: input.generation,
        state: 'off'
      })
    }
    return session.realtime.stop(input)
  }

  holds = (sessionId: string): boolean => this.sessions.get(sessionId)?.realtime?.holdsWork === true

  appendText: StructuredAgentSessionVoiceAdapter['appendText'] = async (input) => {
    const session = this.sessions.get(input.sessionId)
    if (!session || session.ended || session.fence !== input.fence) {
      return false
    }
    return session.realtime?.appendText(input) ?? false
  }

  capability: StructuredAgentSessionVoiceAdapter['capability'] = (sessionId) => {
    const session = this.sessions.get(sessionId)
    return session && !session.ended
      ? readCodexRealtimeSupport(session.connection, this.deps.requestTimeoutMs)
      : Promise.resolve({
          supported: null,
          reason: 'Native voice support will be checked when this conversation connects.'
        })
  }

  handles(event: CodexStructuredSessionEvent): event is CodexRealtimeEvent {
    return event.type === 'notification' && event.method.startsWith('thread/realtime/')
  }

  notification(session: CodexSession, event: CodexRealtimeEvent): CodexJournalTranslationAdmission {
    const admission =
      event.method === 'thread/realtime/item/completed'
        ? (session.translator?.handle(event) ?? { accepted: true as const })
        : { accepted: true as const }
    if (admission.accepted && isProviderRecord(event.params)) {
      session.realtime?.observe(event.method, event.params)
    }
    return admission
  }
}
