import { LayoutGrid } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentHubArrangeMenu } from './AgentHubArrangeMenu'
import { DOCK_BUTTON, DockButton } from './AgentHubDockParts'
import { arrangeAgentHubFloatingWindowsByDefault } from './agent-hub-floating-arrangement'

export function AgentHubDockArrangeButton({
  open,
  side,
  onOpenChange
}: {
  open: boolean
  side: 'top' | 'bottom' | 'left' | 'right'
  onOpenChange: (open: boolean) => void
}): React.JSX.Element | null {
  if (!open) {
    return null
  }
  return (
    <AgentHubArrangeMenu onOpenChange={onOpenChange}>
      <DockButton
        label={translate('agentHub.dock.arrange', 'Arrange mirrors')}
        actionId="agentHub.arrangeMirrors"
        side={side}
        className={DOCK_BUTTON}
        onClick={arrangeAgentHubFloatingWindowsByDefault}
      >
        <LayoutGrid className="size-3.5" />
      </DockButton>
    </AgentHubArrangeMenu>
  )
}
