import { activateTabAndFocusPane } from '@/lib/workspace/tabs/activate-tab-and-focus-pane'
import { revealFloatingWorkspacePanel } from '@/lib/floating-workspace-panel-reveal'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { jumpToWorktreeFromSidebar } from '@/lib/workspace/activation/worktree-jump-navigation'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import {
  getSettingsFocusedExecutionHostId,
  getWorktreeExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { findKnownWorktreeById } from '@/store/slices/worktrees/listing/detected-worktree-meta'
import type { AppState } from '@/store/types'
import type { AgentPaneThread } from './activity-thread-types'

// Same focused-host fallback the Agents scope filter uses; defaulting to `local` here would
// look up a hostless runtime-owned workspace on the wrong host and silently drop the jump.
function getActivityThreadExecutionHostId(
  thread: Pick<AgentPaneThread, 'worktree' | 'repo'>,
  defaultHostId: ExecutionHostId
): ExecutionHostId {
  return getWorktreeExecutionHostId(thread.worktree, thread.repo ?? undefined, defaultHostId)
}

type ActivityThreadWorkspaceCatalog = Pick<
  AppState,
  'worktreesByRepo' | 'detectedWorktreesByRepo' | 'folderWorkspaces' | 'floatingWorkspacePath'
> & { defaultHostId: ExecutionHostId }

function readActivityThreadWorkspaceCatalog(): ActivityThreadWorkspaceCatalog {
  const state = useAppStore.getState()
  return { ...state, defaultHostId: getSettingsFocusedExecutionHostId(state.settings) }
}

export function hasActivityThreadWorkspace(
  thread: AgentPaneThread,
  catalog: ActivityThreadWorkspaceCatalog = readActivityThreadWorkspaceCatalog()
): boolean {
  return Boolean(
    findKnownWorktreeById(
      catalog,
      thread.worktree.id,
      getActivityThreadExecutionHostId(thread, catalog.defaultHostId)
    )
  )
}

export type WorkspacePaneTarget = Pick<AgentPaneThread, 'worktree' | 'repo'> & {
  tabId: string
  /** Null focuses the tab's active pane. */
  paneKey: string | null
}

/** Reveal a pane where it lives: its workspace, or the floating panel for floating tabs. */
export function activateWorkspacePaneTarget(
  target: WorkspacePaneTarget,
  options: { revealInSidebar?: boolean } = {}
): void {
  const isFloatingTerminal = target.worktree.id === FLOATING_TERMINAL_WORKTREE_ID
  const executionHostId = getActivityThreadExecutionHostId(
    target,
    getSettingsFocusedExecutionHostId(useAppStore.getState().settings)
  )
  // Why the full sequence (not bare setActiveWorktree): a cold-parked thread — the normal
  // state of an SSH session that was never revived — has no resident tab until
  // resumeSleepingAgentSessionsForWorktree/ensureWorktreeHasInitialTerminal run inside here.
  // Probing tab residency first is what made a remote row click a silent no-op (#16731).
  if (
    !isFloatingTerminal &&
    activateAndRevealWorkspace(target.worktree.id, {
      executionHostId,
      revealInSidebar: options.revealInSidebar ?? false,
      clearSidebarFilters: false
    }) === false
  ) {
    return
  }
  if (activateStructuredAgentSessionTab({ worktreeId: target.worktree.id, tabId: target.tabId })) {
    if (isFloatingTerminal) {
      revealFloatingWorkspacePanel(useAppStore.getState())
    }
    return
  }
  // Read post-activation: the tab this thread points at may have only just been revived.
  const activated = useAppStore.getState()
  const liveTabs = activated.tabsByWorktree[target.worktree.id] ?? []
  if (!liveTabs.some((tab) => tab.id === target.tabId)) {
    // Retained threads outlive their tab; the workspace is still activated, but there is
    // no pane to focus and focusing a sibling would be worse than focusing nothing.
    return
  }
  // Floating tabs have no catalog workspace; reveal their panel without changing the main workspace.
  if (isFloatingTerminal) {
    revealFloatingWorkspacePanel(activated)
  }
  activated.setActiveTabType('terminal', target.worktree.id)
  const parsed = target.paneKey ? parsePaneKey(target.paneKey) : null
  activateTabAndFocusPane(
    target.tabId,
    parsed && parsed.tabId === target.tabId ? parsed.leafId : null,
    {
      flashFocusedPane: true,
      scrollToBottomIfOutputSinceLastView: true
    }
  )
}

export function createActivityThreadActions({
  getMarkAllReadThreads,
  acknowledgeAgents,
  unacknowledgeAgents,
  setSelectedPaneKey
}: {
  /** Read current badge-coherent threads through a stable handler; Mark all read ignores search/scope so the badge reaches zero. */
  getMarkAllReadThreads: () => AgentPaneThread[]
  acknowledgeAgents: (paneKeys: string[], reads?: undefined, intent?: 'explicit') => void
  unacknowledgeAgents: (paneKeys: string[]) => void
  setSelectedPaneKey: (paneKey: string | null) => void
}): {
  markThreadRead: (thread: AgentPaneThread) => void
  markThreadUnread: (thread: AgentPaneThread) => void
  markThreadsRead: (threads: readonly AgentPaneThread[]) => void
  markThreadsUnread: (threads: readonly AgentPaneThread[]) => void
  selectThread: (thread: AgentPaneThread) => void
  jumpToWorkspace: (thread: AgentPaneThread) => void
  markAllThreadsRead: () => void
} {
  const markThreadsRead = (threads: readonly AgentPaneThread[]): void => {
    acknowledgeAgents(
      threads.map((thread) => thread.paneKey),
      undefined,
      'explicit'
    )
  }

  const markThreadsUnread = (threads: readonly AgentPaneThread[]): void => {
    unacknowledgeAgents(threads.map((thread) => thread.paneKey))
  }

  const markThreadRead = (thread: AgentPaneThread): void => markThreadsRead([thread])

  const markThreadUnread = (thread: AgentPaneThread): void => markThreadsUnread([thread])

  const selectThread = (thread: AgentPaneThread): void => {
    setSelectedPaneKey(thread.paneKey)
    activateWorkspacePaneTarget({
      worktree: thread.worktree,
      repo: thread.repo,
      tabId: thread.tab.id,
      paneKey: thread.paneKey
    })
  }

  const jumpToWorkspace = (thread: AgentPaneThread): void => {
    const catalog = readActivityThreadWorkspaceCatalog()
    if (!hasActivityThreadWorkspace(thread, catalog)) {
      return
    }
    markThreadRead(thread)
    jumpToWorktreeFromSidebar(thread.worktree.id, {
      executionHostId: getActivityThreadExecutionHostId(thread, catalog.defaultHostId)
    })
  }

  const markAllThreadsRead = (): void => {
    const unreadKeys = getMarkAllReadThreads()
      .filter((t) => t.unread)
      .map((t) => t.paneKey)
    if (unreadKeys.length === 0) {
      return
    }
    acknowledgeAgents(unreadKeys, undefined, 'explicit')
  }

  return {
    markThreadRead,
    markThreadUnread,
    markThreadsRead,
    markThreadsUnread,
    selectThread,
    jumpToWorkspace,
    markAllThreadsRead
  }
}
