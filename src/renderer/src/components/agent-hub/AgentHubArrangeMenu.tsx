import { Columns3, LayoutGrid, Rows3 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { arrangeAgentHubFloatingWindowsOnScreen } from './agent-hub-floating-arrangement'

/**
 * Right-click on the hub's mirror controls: lay every floating window (mirrors and the floating
 * workspace) out evenly between the sidebars.
 */
export function AgentHubArrangeMenu({
  children,
  onOpenChange
}: {
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>
        <span className="contents">{children}</span>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>
          {translate('agentHub.arrange.title', 'Arrange floating windows')}
        </ContextMenuLabel>
        <ContextMenuItem onSelect={() => arrangeAgentHubFloatingWindowsOnScreen('grid')}>
          <LayoutGrid />
          {translate('agentHub.arrange.grid', 'In a grid')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => arrangeAgentHubFloatingWindowsOnScreen('columns')}>
          <Columns3 />
          {translate('agentHub.arrange.columns', 'Side by side')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => arrangeAgentHubFloatingWindowsOnScreen('rows')}>
          <Rows3 />
          {translate('agentHub.arrange.rows', 'Stacked')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
