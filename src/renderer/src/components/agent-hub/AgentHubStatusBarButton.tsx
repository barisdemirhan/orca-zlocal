import { PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { AgentHubShortcut } from './AgentHubShortcut'
import { AgentHubStatusTrigger } from './AgentHubStatusTrigger'

/** The hub's status-bar trigger with its shortcut tooltip; needs a Popover around it. */
export function AgentHubStatusBarButton(
  props: React.ComponentProps<typeof AgentHubStatusTrigger>
): React.JSX.Element {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>
          <AgentHubStatusTrigger {...props} />
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        <span className="flex items-center gap-2">
          {translate('agentHub.title', 'Agents')}
          <AgentHubShortcut actionId="agentHub.toggle" />
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
