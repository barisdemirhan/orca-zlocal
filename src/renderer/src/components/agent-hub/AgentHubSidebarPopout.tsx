import { useAppStore } from '@/store'
import type { DashboardAgentRow } from '../dashboard/rows/dashboard-agent-row'
import { openAgentHubMirrorInLayout } from './agent-hub-floating-arrangement'
import {
  agentHubSidebarPopoutTarget,
  canPopOutAgentHubSidebarRow
} from './agent-hub-sidebar-popout'
import { AgentHubPopOutButton } from './AgentHubPopOutButton'
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
  return (
    <AgentHubPopOutButton
      revealClassName="shrink-0 can-hover:opacity-0 group-hover/agent-row:opacity-100 group-focus-within/agent-row:opacity-100 group-hover/compact-agent-row:opacity-100 group-focus-within/compact-agent-row:opacity-100 focus-within:opacity-100"
      withShortcut
      onPopOut={() => {
        const state = useAppStore.getState()
        const tree = agentHubTerminalTreeFromState(state, [], true, new Map())
        const target = agentHubSidebarPopoutTarget(agent, tree, true, visibleWorkspace)
        if (!target) {
          return
        }
        openAgentHubMirrorInLayout(target)
        state.acknowledgeAgents([agent.paneKey])
      }}
    />
  )
}
