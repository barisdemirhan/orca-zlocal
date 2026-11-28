import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import { folderWorkspaceToWorktree } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { TerminalAgent } from '../../../../shared/agent-status/identity/terminal-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import type { Bot } from '../../../../shared/bot-types'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { agentHubSection, type AgentHubCounts } from './agent-hub-lists'

/** The bot behind a workspace: its home (every chat there is the bot's) or a workspace beneath it. */
export type AgentHubRowBot = { bot: Bot; home: boolean }

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
  /** A thread-less tab's agent, sitting idle (see agent-hub-idle-agent); null for a real shell. */
  idleAgent: TerminalAgent | null
  /** Worker panes this agent dispatched, listed under it instead of in their own workspace. */
  children: AgentHubTerminalRow[]
  /** Set when the pane sits in a bot's home or in a workspace the bot opened. */
  bot?: AgentHubRowBot
}

export type AgentHubWorkspaceNode = {
  key: string
  /** The workspace's own worktree (synthetic for a folder workspace or the floating terminal). */
  worktree: Worktree
  projectLabel: string
  /** Worktree name; null for folder workspaces and the floating terminal. */
  workspaceLabel: string | null
  rows: AgentHubTerminalRow[]
  bot?: AgentHubRowBot
  /** Idle agents folded out of `rows` (or shown, when `open`); set only while the fold is on. */
  idleFold?: { count: number; open: boolean; rows: AgentHubTerminalRow[] }
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
  /** False lists agent panes only. */
  includeShells: boolean
  /** Names the agent idling in a tab that has no thread. */
  idleAgentOf?: (tab: TerminalTab) => TerminalAgent | null
  ungroupedLabel: string
  /** Project name for worktrees whose repo is not in the catalog (the sidebar's "Unknown"). */
  unknownProjectLabel: string
  /** Worker pane → its dispatcher (see agent-hub-lineage). */
  parentOf?: ReadonlyMap<string, string>
  /** The bot a workspace belongs to; absent while bots are off. */
  botOf?: (worktree: Worktree) => AgentHubRowBot | null
  botsGroupLabel?: string
}

export const AGENT_HUB_FLOATING_GROUP_KEY = 'floating'
export const AGENT_HUB_BOTS_GROUP = 'agent-hub:bots'
const UNGROUPED_GROUP_KEY = 'ungrouped'

function shellTabTitle(tab: TerminalTab): string {
  return (tab.customTitle ?? tab.title).trim()
}

function buildRows(
  worktree: Worktree,
  repo: Repo | null,
  tabs: readonly TerminalTab[],
  threadsByTabId: ReadonlyMap<string, AgentPaneThread[]>,
  input: Pick<AgentHubTerminalTreeInput, 'includeShells' | 'idleAgentOf' | 'botOf'>
): AgentHubTerminalRow[] {
  const rows: AgentHubTerminalRow[] = []
  const bot = input.botOf?.(worktree) ?? undefined
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
          thread,
          idleAgent: null,
          children: [],
          bot
        })
      }
      continue
    }
    const idleAgent = input.idleAgentOf?.(tab) ?? null
    if (!input.includeShells && !idleAgent) {
      continue
    }
    rows.push({
      key: tab.id,
      worktree,
      repo,
      tab,
      paneKey: null,
      title: shellTabTitle(tab),
      thread: null,
      idleAgent,
      children: [],
      bot
    })
  }
  return rows
}

export function countRows(
  workspaces: readonly AgentHubWorkspaceNode[]
): Pick<AgentHubGroupNode, 'counts' | 'rowCount' | 'agentRowCount'> {
  const counts: AgentHubCounts = { needsYou: 0, working: 0, finished: 0 }
  let rowCount = 0
  let agentRowCount = 0
  const visit = (row: AgentHubTerminalRow): void => {
    rowCount += 1
    agentRowCount += row.thread || row.idleAgent ? 1 : 0
    const section = row.thread ? agentHubSection(row.thread) : null
    if (section) {
      counts[section] += 1
    }
    row.children.forEach(visit)
  }
  for (const workspace of workspaces) {
    workspace.rows.forEach(visit)
  }
  return { counts, rowCount, agentRowCount }
}

/** The tree without plain shells: every agent terminal, busy or idle. */
export function agentOnlyAgentHubTree(groups: readonly AgentHubGroupNode[]): AgentHubGroupNode[] {
  return groups.flatMap((group) => {
    const workspaces = group.workspaces.flatMap((workspace) => {
      const rows = workspace.rows.filter((row) => row.thread || row.idleAgent)
      return rows.length > 0 ? [{ ...workspace, rows }] : []
    })
    return workspaces.length > 0 ? [{ ...group, workspaces, ...countRows(workspaces) }] : []
  })
}

/** Moves each worker row under its dispatcher's row, wherever that row lives. */
function nestWorkerRows(
  workspaces: readonly AgentHubWorkspaceNode[],
  parentOf: ReadonlyMap<string, string> | undefined
): void {
  if (!parentOf || parentOf.size === 0) {
    return
  }
  const rowByPaneKey = new Map<string, AgentHubTerminalRow>()
  for (const workspace of workspaces) {
    for (const row of workspace.rows) {
      if (row.paneKey) {
        rowByPaneKey.set(row.paneKey, row)
      }
    }
  }
  const nested = new Set<AgentHubTerminalRow>()
  for (const [childPaneKey, parentPaneKey] of parentOf) {
    const child = rowByPaneKey.get(childPaneKey)
    const parent = rowByPaneKey.get(parentPaneKey)
    // A bot's worker keeps its own workspace, so it stays listed when the bot's chats are hidden.
    if (child && parent && !parent.bot?.home) {
      parent.children.push(child)
      nested.add(child)
    }
  }
  for (const workspace of workspaces) {
    workspace.rows = workspace.rows.filter((row) => !nested.has(row))
  }
}

/**
 * Group › project › workspace › terminal, in the sidebar's own orders. Only workspaces
 * with an open terminal or chat appear; agents whose tab is gone stay in the Inbox only.
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

  const placed: { groupKey: string; node: AgentHubWorkspaceNode }[] = []
  const addWorkspace = (groupKey: string, node: AgentHubWorkspaceNode): void => {
    if (node.rows.length === 0) {
      return
    }
    const bot = input.botOf?.(node.worktree) ?? undefined
    placed.push({
      groupKey: bot?.home ? AGENT_HUB_BOTS_GROUP : groupKey,
      node: bot ? { ...node, bot } : node
    })
  }

  const groupIds = new Set(input.projectGroups.map((group) => group.id))
  const groupKeyFor = (projectGroupId: string | null | undefined): string =>
    projectGroupId && groupIds.has(projectGroupId) ? projectGroupId : UNGROUPED_GROUP_KEY

  const knownRepoIds = new Set(input.repos.map((repo) => repo.id))
  const addWorktrees = (repoId: string, repo: Repo | null): void => {
    for (const worktree of input.worktreesByRepo[repoId] ?? []) {
      if (worktree.isArchived) {
        continue
      }
      addWorkspace(groupKeyFor(repo?.projectGroupId), {
        key: worktree.id,
        worktree,
        projectLabel: repo?.displayName ?? input.unknownProjectLabel,
        workspaceLabel: worktree.displayName || worktree.branch || null,
        rows: buildRows(
          worktree,
          repo,
          input.tabsByWorktree[worktree.id] ?? [],
          threadsByTabId,
          input
        )
      })
    }
  }
  for (const repo of input.repos) {
    addWorktrees(repo.id, repo)
  }
  // Like the sidebar, keep worktrees whose repo dropped out of the catalog visible.
  for (const repoId of Object.keys(input.worktreesByRepo)) {
    if (!knownRepoIds.has(repoId)) {
      addWorktrees(repoId, null)
    }
  }
  for (const folderWorkspace of input.folderWorkspaces) {
    if (folderWorkspace.isArchived) {
      continue
    }
    const worktree = folderWorkspaceToWorktree(folderWorkspace)
    addWorkspace(groupKeyFor(folderWorkspace.projectGroupId), {
      key: worktree.id,
      worktree,
      projectLabel: folderWorkspace.name,
      workspaceLabel: null,
      rows: buildRows(
        worktree,
        null,
        input.tabsByWorktree[worktree.id] ?? [],
        threadsByTabId,
        input
      )
    })
  }
  if (input.floating) {
    const { worktree, label } = input.floating
    addWorkspace(AGENT_HUB_FLOATING_GROUP_KEY, {
      key: worktree.id,
      worktree,
      projectLabel: label,
      workspaceLabel: null,
      rows: buildRows(
        worktree,
        null,
        input.tabsByWorktree[worktree.id] ?? [],
        threadsByTabId,
        input
      )
    })
  }

  nestWorkerRows(
    placed.map(({ node }) => node),
    input.parentOf
  )
  const workspacesByGroupKey = new Map<string, AgentHubWorkspaceNode[]>()
  for (const { groupKey, node } of placed) {
    // A workspace whose rows all moved under a dispatcher elsewhere drops out.
    if (node.rows.length > 0) {
      workspacesByGroupKey.set(groupKey, [...(workspacesByGroupKey.get(groupKey) ?? []), node])
    }
  }

  const orderedGroups: { key: string; label: string }[] = [
    ...[...input.projectGroups]
      .sort((a, b) => a.tabOrder - b.tabOrder)
      .map((group) => ({ key: group.id, label: group.name })),
    { key: UNGROUPED_GROUP_KEY, label: input.ungroupedLabel },
    { key: AGENT_HUB_FLOATING_GROUP_KEY, label: input.floating?.label ?? '' },
    { key: AGENT_HUB_BOTS_GROUP, label: input.botsGroupLabel ?? 'Bots' }
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
