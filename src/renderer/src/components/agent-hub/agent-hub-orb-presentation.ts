import { translate } from '@/i18n/i18n'
import type { DictationState } from '../../../../shared/speech/speech-types'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import type { AgentHubOrbPhase } from './agent-hub-orb-phase'
import type { AgentHubOrbVoiceSnapshot } from './agent-hub-orb-voice-state'

export function agentHubOrbPresentation(
  state: AgentHubOrbState,
  voice: AgentHubOrbVoiceSnapshot,
  hasRequest: boolean,
  dictation?: DictationState | null,
  approval = false,
  attention = false
): { phase: AgentHubOrbPhase; label: string } {
  let phase: AgentHubOrbPhase = 'idle'
  const needsApproval =
    approval ||
    (state.kind === 'needsYou' &&
      state.request.kind === 'prompt' &&
      state.request.item.body.kind === 'approval')
  if (voice.connection === 'error' || dictation === 'error' || state.kind === 'error') {
    phase = 'error'
  } else if (hasRequest || state.kind === 'needsYou') {
    phase = needsApproval ? 'approval' : 'request'
  } else if (voice.connection === 'stopping') {
    phase = 'stopping'
  } else if (voice.connection === 'connecting' || dictation === 'starting') {
    phase = 'connecting'
  } else if (dictation === 'listening') {
    phase = 'dictating'
  } else if (dictation === 'stopping') {
    phase = 'transcribing'
  } else if (voice.output === 'speaking') {
    phase = 'speaking'
  } else if (state.kind === 'working') {
    phase = 'thinking'
  } else if (attention) {
    phase = 'attention'
  } else if (voice.connection === 'live' || state.kind === 'listening') {
    phase = 'listening'
  } else if (state.kind === 'done') {
    phase = 'result'
  } else if (state.kind === 'off') {
    phase = 'off'
  }
  const labels: Record<AgentHubOrbPhase, string> = {
    idle: translate('auto.agentHub.orb.ready', 'Ready'),
    off: translate('auto.agentHub.orb.ready', 'Ready'),
    listening: translate('auto.agentHub.orb.listening', 'Listening'),
    thinking: translate('auto.agentHub.orb.working', 'Working'),
    speaking: translate('auto.agentHub.orb.speaking', 'Speaking'),
    attention: translate('agentHub.orb.attention', 'An agent sent an update'),
    request: translate('auto.agentHub.orb.needsAnswer', 'Waiting for your answer'),
    approval: translate('agentHub.orb.needsApproval', 'Waiting for your approval'),
    result: translate('auto.agentHub.orb.done', 'Completed'),
    error:
      voice.reason ??
      (state.kind === 'error'
        ? translate('agentHub.orb.taskFailed', 'The task could not complete.')
        : translate('auto.agentHub.orb.voiceFailed', 'Live voice could not connect.')),
    connecting: translate('auto.agentHub.orb.voiceConnecting', 'Connecting live voice…'),
    stopping: translate('auto.agentHub.orb.voiceStopping', 'Ending live voice…'),
    dictating: translate('agentHub.card.dictate', 'Dictate'),
    transcribing: translate('agentHub.orb.transcribing', 'Preparing dictated text…')
  }
  const mutedLive = voice.connection === 'live' && voice.input === 'muted'
  const label =
    phase === 'speaking' && voice.input === 'muted'
      ? translate(
          'auto.agentHub.orb.speakingMuted',
          'Speaking. Microphone muted; live voice remains connected.'
        )
      : mutedLive && phase === 'listening'
        ? translate('auto.agentHub.orb.muted', 'Microphone muted; live voice remains connected.')
        : labels[phase]
  return { phase, label }
}
