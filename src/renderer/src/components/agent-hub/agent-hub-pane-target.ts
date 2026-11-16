import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AppState } from '@/store/types'
import type { DashboardCardTerminalInput } from '../../../../shared/dashboard-snapshot'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { getActivityThreadWorkspaceTitle } from '@/lib/workspace/activity/activity-thread-display'
import { readDashboardClientHost } from '../dashboard/snapshot/dashboard-client-host'
import { resolveDashboardCardTerminalInput } from '../dashboard/snapshot/dashboard-card-terminal-input'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'

/** A pane the hub can mirror or reveal: an agent pane, or a shell tab's active pane. */
export type AgentHubPaneTarget = {
  worktree: Worktree
  repo: Repo | null
  tab: TerminalTab
  /** Null targets the tab's active pane. */
  paneKey: string | null
  title: string
  agentType: AgentType | null
}

export function paneTargetFromThread(thread: AgentPaneThread, title: string): AgentHubPaneTarget {
  return {
    worktree: thread.worktree,
    repo: thread.repo,
    tab: thread.tab,
    paneKey: thread.paneKey,
    title,
    agentType: thread.agentType
  }
}

/** What a jump or pop-out needs to open a thread's own pane. */
export function threadOpenRequest(thread: AgentPaneThread): {
  target: AgentHubPaneTarget
  thread: AgentPaneThread
} {
  return { target: paneTargetFromThread(thread, activityThreadRowCopy(thread).taskTitle), thread }
}

export function paneTargetFromTerminalRow(row: AgentHubTerminalRow): AgentHubPaneTarget {
  return {
    worktree: row.worktree,
    repo: row.repo,
    tab: row.tab,
    paneKey: row.paneKey,
    title: row.title,
    agentType: row.thread?.agentType ?? row.idleAgent
  }
}

export function agentHubPaneTargetKey(target: AgentHubPaneTarget): string {
  return target.paneKey ?? target.tab.id
}

/** Whether a target mirrors this agent; a shell target (no pane key) owns its tab's agent. */
export function agentHubTargetShowsThread(
  target: AgentHubPaneTarget,
  thread: Pick<AgentPaneThread, 'paneKey' | 'tab'> & Partial<Pick<AgentPaneThread, 'worktree'>>
): boolean {
  if (
    thread.worktree &&
    getWorktreeHostIdentity(target.worktree) !== getWorktreeHostIdentity(thread.worktree)
  ) {
    return false
  }
  return target.paneKey ? target.paneKey === thread.paneKey : target.tab.id === thread.tab.id
}

/** The pane's live PTY, or null once it exited or was never spawned this session. */
export function resolveAgentHubPtyId(
  state: Pick<AppState, 'terminalLayoutsByTabId' | 'ptyIdsByTabId'>,
  tabId: string,
  paneKey: string | null
): string | null {
  const layout = state.terminalLayoutsByTabId[tabId]
  const parsedLeafId = paneKey ? parsePaneKey(paneKey)?.leafId : undefined
  const leafId = paneKey ? parsedLeafId : layout?.activeLeafId
  const livePtyIds = state.ptyIdsByTabId[tabId] ?? []
  const layoutPtyId = leafId ? layout?.ptyIdsByLeafId?.[leafId] : undefined
  // Why: layouts survive restarts while their PTYs do not; ptyIdsByTabId is the liveness truth.
  if (layoutPtyId && livePtyIds.includes(layoutPtyId)) {
    return layoutPtyId
  }
  // A single-pane shell tab may not have published a layout yet.
  return !paneKey && livePtyIds.length === 1 ? (livePtyIds[0] ?? null) : null
}

/** Key encodings for the mirror follow the PTY's execution host, like the dashboard preview. */
export function resolveAgentHubTerminalInput(
  state: AppState,
  target: AgentHubPaneTarget,
  ptyId: string
): DashboardCardTerminalInput {
  const clientHost = readDashboardClientHost()
  const layout = state.terminalLayoutsByTabId[target.tab.id]
  const leafId = target.paneKey
    ? parsePaneKey(target.paneKey)?.leafId
    : (layout?.activeLeafId ?? undefined)
  return resolveDashboardCardTerminalInput(state, {
    ptyId,
    worktreeId: target.worktree.id,
    paneKey: target.paneKey ?? (leafId ? `${target.tab.id}:${leafId}` : target.tab.id),
    cwd: target.tab.startupCwd ?? target.worktree.path,
    shellOverride: target.tab.shellOverride,
    launchAgent: target.tab.launchAgent,
    clientPlatform: clientHost.platform,
    userAgent: clientHost.userAgent,
    osRelease: clientHost.osRelease
  })
}

export type AgentHubLocation = {
  group: string | null
  project: string
  workspace: string | null
  /** The machine's name, only when workspaces span more than one host. */
  host?: string | null
}

/** Group › project · workspace; folder and floating panes have only the workspace name. */
export function agentHubLocation(
  target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>,
  groupNameById: ReadonlyMap<string, string>,
  hostLabelByIdentity?: ReadonlyMap<string, string>
): AgentHubLocation {
  const workspace = getActivityThreadWorkspaceTitle(target.worktree)
  const host = hostLabelByIdentity?.get(getWorktreeHostIdentity(target.worktree)) ?? null
  if (!target.repo) {
    return { group: null, project: workspace, workspace: null, host }
  }
  const project = target.repo.displayName
  const group = target.repo.projectGroupId ? groupNameById.get(target.repo.projectGroupId) : null
  return {
    group: group ?? null,
    project,
    workspace: workspace === project ? null : workspace,
    host
  }
}

export function agentHubLocationLabel(
  target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>,
  groupNameById: ReadonlyMap<string, string>
): string {
  const { group, project, workspace } = agentHubLocation(target, groupNameById)
  const head = group ? `${group} › ${project}` : project
  return workspace ? `${head} · ${workspace}` : head
}
