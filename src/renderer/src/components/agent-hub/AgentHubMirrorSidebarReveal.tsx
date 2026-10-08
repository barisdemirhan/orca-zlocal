import { Crosshair } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { requestWorkspaceSidebarReveal } from '@/lib/scroll-to-current-workspace-status'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { selectFloatingWorkspacePanelVisible } from '@/store/floating-workspace-panel-selector'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { minimizeAllAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function AgentHubMirrorSidebarReveal({
  target
}: {
  target: AgentHubPaneTarget
}): React.JSX.Element | null {
  if (target.worktree.id === FLOATING_TERMINAL_WORKTREE_ID) {
    return null
  }
  const label = translate('agentHub.mirror.showInSidebar', 'Show in sidebar')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            const state = useAppStore.getState()
            if (!state.sidebarOpen) {
              state.setSidebarOpen(true)
            }
            minimizeAllAgentHubMirrors()
            if (selectFloatingWorkspacePanelVisible(state)) {
              window.dispatchEvent(new Event(TOGGLE_FLOATING_TERMINAL_EVENT))
            }
            // The newly opened sidebar must subscribe before it receives the reveal request.
            requestAnimationFrame(() =>
              requestWorkspaceSidebarReveal(target.worktree.id, target.worktree.hostId)
            )
          }}
        >
          <Crosshair className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
