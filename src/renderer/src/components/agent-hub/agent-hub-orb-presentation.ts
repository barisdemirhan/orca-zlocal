import { translate } from '@/i18n/i18n'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import type { AgentHubOrbPhase } from './AgentHubOrbSphere'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

export function agentHubOrbPresentation(
  state: AgentHubOrbState,
  voice: AgentHubOrbVoiceValue,
  hasRequest: boolean
): { phase: AgentHubOrbPhase; label: string } {
  const phase =
    voice.output === 'speaking'
      ? 'speaking'
      : hasRequest || state.kind === 'needsYou'
        ? 'request'
        : voice.connection === 'error'
          ? 'error'
          : voice.connection === 'stopping'
            ? 'stopping'
            : voice.connection === 'connecting'
              ? 'connecting'
              : voice.connection === 'live' && voice.input === 'muted'
                ? 'muted'
                : state.kind === 'working'
                  ? 'thinking'
                  : voice.connection === 'live' || state.kind === 'listening'
                    ? 'listening'
                    : state.kind === 'done'
                      ? 'result'
                      : 'idle'
  const label =
    phase === 'speaking'
      ? voice.input === 'muted'
        ? translate(
            'auto.agentHub.orb.speakingMuted',
            'Speaking. Microphone muted; live voice remains connected.'
          )
        : translate('auto.agentHub.orb.speaking', 'Speaking')
      : phase === 'request'
        ? translate('auto.agentHub.orb.needsAnswer', 'Waiting for your answer')
        : phase === 'error'
          ? (voice.reason ??
            translate('auto.agentHub.orb.voiceFailed', 'Live voice could not connect.'))
          : phase === 'stopping'
            ? translate('auto.agentHub.orb.voiceStopping', 'Ending live voice…')
            : phase === 'connecting'
              ? translate('auto.agentHub.orb.voiceConnecting', 'Connecting live voice…')
              : phase === 'muted'
                ? translate(
                    'auto.agentHub.orb.muted',
                    'Microphone muted; live voice remains connected.'
                  )
                : phase === 'thinking'
                  ? translate('auto.agentHub.orb.working', 'Working')
                  : phase === 'listening'
                    ? translate('auto.agentHub.orb.listening', 'Listening')
                    : phase === 'result'
                      ? translate('auto.agentHub.orb.done', 'Completed')
                      : translate('auto.agentHub.orb.ready', 'Ready')
  return { phase, label }
}
