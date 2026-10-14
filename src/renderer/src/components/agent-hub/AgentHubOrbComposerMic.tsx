import { useContext } from 'react'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { AgentHubDictationPill } from './AgentHubDictationPill'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import { useMirrorShowsDictation } from './agent-hub-mirror-dictation-display'
import { AgentHubOrbComposerContext, toggleAgentHubOrb } from './agent-hub-orb-composer'

export function AgentHubOrbComposerMic({ disabled }: { disabled: boolean }): React.JSX.Element {
  const tabId = useContext(AgentHubOrbComposerContext)
  const session = useAgentHubDictationSession()
  const state = useAppStore((s) => s.dictationState)
  const listening = Boolean(tabId && session?.pane?.tabId === tabId)
  useMirrorShowsDictation(listening)
  const label = translate('agentHub.card.dictate', 'Dictate')
  return listening ? (
    <AgentHubDictationPill
      compact
      phase={state === 'stopping' ? 'finishing' : state === 'starting' ? 'starting' : 'listening'}
      stopActionId="agentHub.toggleOrb"
      stopHint={translate('auto.agentHub.orb.toSend', 'to send')}
    />
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || session !== null}
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleAgentHubOrb}
        >
          <Mic />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
