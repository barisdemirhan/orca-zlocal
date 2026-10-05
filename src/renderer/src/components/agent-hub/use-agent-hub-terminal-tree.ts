import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { standaloneActivityWorktree } from '../activity/activity-standalone-worktree'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { resolveAgentHubIdleAgent } from './agent-hub-idle-agent'
import { buildAgentHubTerminalTree, type AgentHubGroupNode } from './agent-hub-terminal-tree'

/** The All terminals tree. Mounted only while the popover is open, so tab churn costs nothing otherwise. */
export function useAgentHubTerminalTree(
  threads: readonly AgentPaneThread[],
  includeShells: boolean,
  parentOf: ReadonlyMap<string, string>
): AgentHubGroupNode[] {
  const projectGroups = useAppStore((s) => s.projectGroups)
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  // What names an agent that is open but quiet (no thread), e.g. after a restart.
  const idleSignals = useAppStore(
    useShallow((s) => ({
      terminalLayoutsByTabId: s.terminalLayoutsByTabId,
      runtimePaneTitlesByTabId: s.runtimePaneTitlesByTabId,
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      retainedAgentsByPaneKey: s.retainedAgentsByPaneKey,
      sleepingAgentSessionsByPaneKey: s.sleepingAgentSessionsByPaneKey,
      paneForegroundAgentByPaneKey: s.paneForegroundAgentByPaneKey
    }))
  )
  return useMemo(
    () =>
      buildAgentHubTerminalTree({
        projectGroups,
        repos,
        worktreesByRepo,
        folderWorkspaces,
        tabsByWorktree,
        threads,
        floating: (() => {
          const worktree = standaloneActivityWorktree(FLOATING_TERMINAL_WORKTREE_ID)
          return { worktree, label: worktree.displayName }
        })(),
        includeShells,
        idleAgentOf: (tab) => resolveAgentHubIdleAgent(tab, idleSignals),
        ungroupedLabel: translate('agentHub.terminals.ungrouped', 'Ungrouped'),
        unknownProjectLabel: translate('agentHub.terminals.unknownProject', 'Unknown'),
        parentOf
      }),
    [
      projectGroups,
      repos,
      worktreesByRepo,
      folderWorkspaces,
      tabsByWorktree,
      threads,
      includeShells,
      idleSignals,
      parentOf
    ]
  )
}
