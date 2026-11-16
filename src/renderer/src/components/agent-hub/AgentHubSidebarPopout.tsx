import { AgentHubShortcut } from './AgentHubShortcut'
import { PictureInPicture2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import type { DashboardAgentRow } from '../dashboard/rows/dashboard-agent-row'
import { openAgentHubMirrorInLayout } from './agent-hub-floating-arrangement'
import {
  agentHubSidebarPopoutTarget,
  canPopOutAgentHubSidebarRow
} from './agent-hub-sidebar-popout'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'

// Stable reference so memoized sidebar rows do not re-render when their parent does.
export function renderAgentHubSidebarPopout(agent: DashboardAgentRow): React.JSX.Element {
  return <AgentHubSidebarPopout agent={agent} />
}

export function AgentHubSidebarPopout({
  agent
}: {
  agent: DashboardAgentRow
}): React.JSX.Element | null {
  const enabled = useAppStore((s) => s.settings?.experimentalAgentHub === true)
  return enabled ? <SidebarPopout agent={agent} /> : null
}

function SidebarPopout({ agent }: { agent: DashboardAgentRow }): React.JSX.Element | null {
  const visibleWorkspace = useAppStore((s) =>
    s.activeView === 'terminal' ? s.activeWorktreeId : null
  )
  if (!canPopOutAgentHubSidebarRow(agent, visibleWorkspace)) {
    return null
  }
  const label = translate('agentHub.row.popOut', 'Pop out')
  return (
    <span className="shrink-0 can-hover:opacity-0 group-hover/agent-row:opacity-100 group-focus-within/agent-row:opacity-100 group-hover/compact-agent-row:opacity-100 group-focus-within/compact-agent-row:opacity-100 focus-within:opacity-100">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            data-agent-hub-sidebar-popout
            className="shrink-0"
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              const state = useAppStore.getState()
              const tree = agentHubTerminalTreeFromState(state, [], true, new Map())
              const target = agentHubSidebarPopoutTarget(agent, tree, true, visibleWorkspace)
              if (!target) {
                return
              }
              openAgentHubMirrorInLayout(target)
              state.acknowledgeAgents([agent.paneKey])
            }}
          >
            <PictureInPicture2 className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <span className="flex items-center gap-2">
            {label}
            <AgentHubShortcut actionId="agentHub.popOut" />
          </span>
        </TooltipContent>
      </Tooltip>
    </span>
  )
}
