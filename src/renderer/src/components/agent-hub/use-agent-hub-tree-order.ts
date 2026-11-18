import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useNow } from '@/lib/window-activity/use-now'
import { useAppStore } from '@/store'
import { useRepoMap } from '@/store/repos/use-repository-catalog'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import type { AgentHubGroupNode } from './agent-hub-terminal-tree'
import { rankAgentHubWorkspaces, type AgentHubTreeOrder } from './agent-hub-terminal-tree-sort'

/** The order the hub's terminal lists are shown in. Mounted with the tree, while the popover is open. */
export function useAgentHubTreeOrder(
  tree: readonly AgentHubGroupNode[],
  sortBy: AgentHubTerminalSort
): AgentHubTreeOrder {
  const repoMap = useRepoMap()
  // Time moves the order too: a fresh result ages out, a new workspace's grace ends.
  const now = useNow(30_000)
  const sources = useAppStore(
    useShallow((s) => ({
      tabsByWorktree: s.tabsByWorktree,
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      runtimePaneTitlesByTabId: s.runtimePaneTitlesByTabId,
      ptyIdsByTabId: s.ptyIdsByTabId,
      migrationUnsupportedByPtyId: s.migrationUnsupportedByPtyId,
      terminalLayoutsByTabId: s.terminalLayoutsByTabId
    }))
  )
  return useMemo(
    () => ({
      sortBy,
      now,
      workspaceRank: rankAgentHubWorkspaces(tree, sortBy, sources, repoMap, now)
    }),
    [tree, sortBy, sources, repoMap, now]
  )
}
