import { useEffect, useMemo } from 'react'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubOpenRequest } from './AgentHubPanel'
import type { AgentHubLists } from './agent-hub-lists'
import { visibleAgentHubRunningThreads, type AgentHubLineage } from './agent-hub-lineage'
import { paneTargetFromTerminalRow, paneTargetFromThread } from './agent-hub-pane-target'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'
import { orderAgentHubRunningThreads } from './agent-hub-running-split'
import { useAgentHubWorktreeBot } from './use-agent-hub-worktree-bot'
import type { AgentHubTab } from './agent-hub-keys'

export type HubItem = AgentHubOpenRequest & { key: string }

export function threadItem(thread: AgentPaneThread): HubItem {
  return {
    key: thread.paneKey,
    thread,
    target: paneTargetFromThread(thread, activityThreadRowCopy(thread).taskTitle)
  }
}

export function threadTarget(thread: AgentPaneThread | null): HubItem['target'] | null {
  return thread ? threadItem(thread).target : null
}

export function rowItem(row: AgentHubTerminalRow): HubItem {
  return { key: row.key, thread: row.thread, target: paneTargetFromTerminalRow(row) }
}

/** The keyboard-navigable rows of the Running, Agents and All tabs. */
export function useAgentHubPanelItems({
  tab,
  lists,
  lineage,
  expandedKeys,
  filteredTree,
  collapseOverrides,
  narrowed,
  foldAgentsList
}: {
  tab: AgentHubTab
  lists: AgentHubLists
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  filteredTree: readonly AgentHubGroupNode[]
  collapseOverrides: ReadonlyMap<string, boolean>
  narrowed: boolean
  foldAgentsList: boolean
}): HubItem[] {
  const botOf = useAgentHubWorktreeBot()
  return useMemo<HubItem[]>(() => {
    if (tab === 'bots' || tab === 'inbox') {
      return []
    }
    if (tab === 'running') {
      return visibleAgentHubRunningThreads(
        orderAgentHubRunningThreads(lists.working, botOf),
        lineage,
        expandedKeys
      ).map(threadItem)
    }
    return visibleAgentHubTreeRows(
      filteredTree,
      collapseOverrides,
      narrowed,
      expandedKeys,
      foldAgentsList
    ).map(rowItem)
  }, [
    tab,
    lists,
    botOf,
    lineage,
    expandedKeys,
    filteredTree,
    collapseOverrides,
    narrowed,
    foldAgentsList
  ])
}

export function useScrollSelectedAgentHubRow(
  rootRef: React.RefObject<HTMLElement | null>,
  selectedKey: string | null
): void {
  useEffect(() => {
    rootRef.current
      ?.querySelector(
        '[data-agent-hub-sender][data-selected="true"], [data-agent-hub-row][data-selected="true"]'
      )
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedKey, rootRef])
}
