import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import { folderWorkspaceToWorktree } from '../../../../shared/folder-workspace-worktree'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { agentHubSection, type AgentHubCounts } from './agent-hub-lists'

/** One terminal pane: an agent pane carries its thread, a plain shell tab does not. */
export type AgentHubTerminalRow = {
  key: string
  worktree: Worktree
  repo: Repo | null
  tab: TerminalTab
  /** Null for a shell row: it targets the tab's active pane. */
  paneKey: string | null
  title: string
  thread: AgentPaneThread | null
}

export type AgentHubWorkspaceNode = {
  key: string
  projectLabel: string
  /** Worktree name; null for folder workspaces and the floating terminal. */
  workspaceLabel: string | null
  rows: AgentHubTerminalRow[]
}

export type AgentHubGroupNode = {
  key: string
  label: string
  workspaces: AgentHubWorkspaceNode[]
  counts: AgentHubCounts
  rowCount: number
  agentRowCount: number
}

export type AgentHubTerminalTreeInput = {
  projectGroups: readonly ProjectGroup[]
  repos: readonly Repo[]
  worktreesByRepo: Readonly<Record<string, readonly Worktree[]>>
  folderWorkspaces: readonly FolderWorkspace[]
  tabsByWorktree: Readonly<Record<string, readonly TerminalTab[]>>
  threads: readonly AgentPaneThread[]
  floating: { worktree: Worktree; label: string } | null
  ungroupedLabel: string
}

export const AGENT_HUB_FLOATING_GROUP_KEY = 'floating'
const UNGROUPED_GROUP_KEY = 'ungrouped'

function shellTabTitle(tab: TerminalTab): string {
  return (tab.customTitle ?? tab.title).trim()
}

function buildRows(
  worktree: Worktree,
  repo: Repo | null,
  tabs: readonly TerminalTab[],
  threadsByTabId: ReadonlyMap<string, AgentPaneThread[]>
): AgentHubTerminalRow[] {
  const rows: AgentHubTerminalRow[] = []
  for (const tab of tabs) {
    const tabThreads = threadsByTabId.get(tab.id)
    if (tabThreads && tabThreads.length > 0) {
      for (const thread of tabThreads) {
        rows.push({
          key: thread.paneKey,
          worktree,
          repo,
          tab,
          paneKey: thread.paneKey,
          title: activityThreadRowCopy(thread).taskTitle || shellTabTitle(tab),
          thread
        })
      }
      continue
    }
    rows.push({
      key: tab.id,
      worktree,
      repo,
      tab,
      paneKey: null,
      title: shellTabTitle(tab),
      thread: null
    })
  }
  return rows
}

function countRows(
  workspaces: readonly AgentHubWorkspaceNode[]
): Pick<AgentHubGroupNode, 'counts' | 'rowCount' | 'agentRowCount'> {
  const counts: AgentHubCounts = { needsYou: 0, working: 0, finished: 0 }
  let rowCount = 0
  let agentRowCount = 0
  for (const workspace of workspaces) {
    for (const row of workspace.rows) {
      rowCount += 1
      agentRowCount += row.thread ? 1 : 0
      const section = row.thread ? agentHubSection(row.thread) : null
      if (section) {
        counts[section] += 1
      }
    }
  }
  return { counts, rowCount, agentRowCount }
}

/**
 * Group › project › workspace › terminal, in the sidebar's own orders. Only workspaces
 * with an open terminal appear; agents whose tab is gone stay in the Inbox only.
 */
export function buildAgentHubTerminalTree(input: AgentHubTerminalTreeInput): AgentHubGroupNode[] {
  const threadsByTabId = new Map<string, AgentPaneThread[]>()
  for (const thread of input.threads) {
    const list = threadsByTabId.get(thread.tab.id)
    if (list) {
      list.push(thread)
    } else {
      threadsByTabId.set(thread.tab.id, [thread])
    }
  }

  const workspacesByGroupKey = new Map<string, AgentHubWorkspaceNode[]>()
  const addWorkspace = (groupKey: string, node: AgentHubWorkspaceNode): void => {
    if (node.rows.length === 0) {
      return
    }
    const list = workspacesByGroupKey.get(groupKey)
    if (list) {
      list.push(node)
    } else {
      workspacesByGroupKey.set(groupKey, [node])
    }
  }

  const groupIds = new Set(input.projectGroups.map((group) => group.id))
  const groupKeyFor = (projectGroupId: string | null | undefined): string =>
    projectGroupId && groupIds.has(projectGroupId) ? projectGroupId : UNGROUPED_GROUP_KEY

  for (const repo of input.repos) {
    for (const worktree of input.worktreesByRepo[repo.id] ?? []) {
      if (worktree.isArchived) {
        continue
      }
      addWorkspace(groupKeyFor(repo.projectGroupId), {
        key: worktree.id,
        projectLabel: repo.displayName,
        workspaceLabel: worktree.displayName || worktree.branch || null,
        rows: buildRows(worktree, repo, input.tabsByWorktree[worktree.id] ?? [], threadsByTabId)
      })
    }
  }
  for (const folderWorkspace of input.folderWorkspaces) {
    if (folderWorkspace.isArchived) {
      continue
    }
    const worktree = folderWorkspaceToWorktree(folderWorkspace)
    addWorkspace(groupKeyFor(folderWorkspace.projectGroupId), {
      key: worktree.id,
      projectLabel: folderWorkspace.name,
      workspaceLabel: null,
      rows: buildRows(worktree, null, input.tabsByWorktree[worktree.id] ?? [], threadsByTabId)
    })
  }
  if (input.floating) {
    const { worktree, label } = input.floating
    addWorkspace(AGENT_HUB_FLOATING_GROUP_KEY, {
      key: worktree.id,
      projectLabel: label,
      workspaceLabel: null,
      rows: buildRows(worktree, null, input.tabsByWorktree[worktree.id] ?? [], threadsByTabId)
    })
  }

  const orderedGroups: { key: string; label: string }[] = [
    ...[...input.projectGroups]
      .sort((a, b) => a.tabOrder - b.tabOrder)
      .map((group) => ({ key: group.id, label: group.name })),
    { key: UNGROUPED_GROUP_KEY, label: input.ungroupedLabel },
    { key: AGENT_HUB_FLOATING_GROUP_KEY, label: input.floating?.label ?? '' }
  ]
  const groups: AgentHubGroupNode[] = []
  for (const { key, label } of orderedGroups) {
    const workspaces = workspacesByGroupKey.get(key)
    if (workspaces) {
      groups.push({ key, label, workspaces, ...countRows(workspaces) })
    }
  }
  return groups
}

function rowSearchText(
  group: AgentHubGroupNode,
  workspace: AgentHubWorkspaceNode,
  row: AgentHubTerminalRow
): string {
  return [
    row.title,
    group.label,
    workspace.projectLabel,
    workspace.workspaceLabel ?? '',
    row.thread ? row.thread.agentType : 'shell'
  ]
    .join(' ')
    .toLowerCase()
}

/** Keep rows whose text holds every query word; empty groups and workspaces drop out. */
export function filterAgentHubTerminalTree(
  groups: readonly AgentHubGroupNode[],
  query: string
): AgentHubGroupNode[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return [...groups]
  }
  const filtered: AgentHubGroupNode[] = []
  for (const group of groups) {
    const workspaces: AgentHubWorkspaceNode[] = []
    for (const workspace of group.workspaces) {
      const rows = workspace.rows.filter((row) => {
        const text = rowSearchText(group, workspace, row)
        return words.every((word) => text.includes(word))
      })
      if (rows.length > 0) {
        workspaces.push({ ...workspace, rows })
      }
    }
    if (workspaces.length > 0) {
      filtered.push({ ...group, workspaces, ...countRows(workspaces) })
    }
  }
  return filtered
}

/** A group starts collapsed when it holds only shells; the user's toggle wins after that. */
export function isAgentHubGroupCollapsed(
  group: AgentHubGroupNode,
  overrides: ReadonlyMap<string, boolean>,
  query: string
): boolean {
  if (query.trim()) {
    return false
  }
  return overrides.get(group.key) ?? group.agentRowCount === 0
}

/** Rows in display order, skipping collapsed groups: the arrow-key selection space. */
export function visibleAgentHubTreeRows(
  groups: readonly AgentHubGroupNode[],
  overrides: ReadonlyMap<string, boolean>,
  query: string
): AgentHubTerminalRow[] {
  return groups.flatMap((group) =>
    isAgentHubGroupCollapsed(group, overrides, query)
      ? []
      : group.workspaces.flatMap((workspace) => workspace.rows)
  )
}
