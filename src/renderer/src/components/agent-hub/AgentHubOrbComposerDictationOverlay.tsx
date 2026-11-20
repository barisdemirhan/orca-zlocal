import { translate } from '@/i18n/i18n'
import { AgentHubDictationPill } from './AgentHubDictationPill'
import { useMirrorShowsDictation } from './agent-hub-mirror-dictation-display'
import { useAgentHubOrbComposerDictation } from './agent-hub-orb-composer'

export function AgentHubOrbComposerDictationOverlay(): React.JSX.Element | null {
  const { phase } = useAgentHubOrbComposerDictation()
  useMirrorShowsDictation(phase !== null)
  if (!phase) {
    return null
  }
  return (
    <div
      data-agent-hub-orb-dictation={phase}
      className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/50 @container/hub-dictation"
    >
      <AgentHubDictationPill
        phase={phase}
        responsiveHint
        stopActionId="agentHub.toggleOrb"
        stopHint={translate('auto.agentHub.orb.toSend', 'to send')}
      />
    </div>
  )
}
