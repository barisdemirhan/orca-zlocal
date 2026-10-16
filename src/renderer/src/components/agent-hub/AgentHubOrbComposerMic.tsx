import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { toggleAgentHubOrb, useAgentHubOrbComposerDictation } from './agent-hub-orb-composer'

export function AgentHubOrbComposerMic({
  disabled
}: {
  disabled: boolean
}): React.JSX.Element | null {
  const { session, phase } = useAgentHubOrbComposerDictation()
  const label = translate('agentHub.card.dictate', 'Dictate')
  return phase ? null : (
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
