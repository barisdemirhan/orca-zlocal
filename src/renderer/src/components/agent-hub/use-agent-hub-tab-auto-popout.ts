import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { closeAgentHubMirrorChipsOfTab, parkAgentHubMirror } from './agent-hub-mirror-store'
import { paneTargetFromTerminalRow } from './agent-hub-pane-target'
import { agentHubRowOfTab, isAgentHubTabAutoPopout } from './agent-hub-tab-auto-popout'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'

type OnScreenTab = { worktreeId: string; tabId: string }

/**
 * Terminal tabs with the auto pop-out toggle on: leaving one (another tab, another workspace,
 * another view) parks its terminal in the tray, and coming back takes the chip away again.
 */
export function useAgentHubTabAutoPopoutOnLeave(
  enabled: boolean,
  threads: readonly AgentPaneThread[],
  parentOf: ReadonlyMap<string, string>
): void {
  // Same notion of "on screen" the mirrors use to decide where a pane can be drawn.
  const onScreen = useAppStore((state) =>
    state.activeView === 'terminal' && state.activeWorktreeId && state.activeTabId
      ? `${state.activeWorktreeId}\u0000${state.activeTabId}`
      : null
  )
  const latest = useRef({ threads, parentOf })
  useEffect(() => {
    latest.current = { threads, parentOf }
  }, [threads, parentOf])
  const previous = useRef<OnScreenTab | null>(null)
  useEffect(() => {
    const [worktreeId, tabId] = onScreen?.split('\u0000') ?? []
    const now = worktreeId && tabId ? { worktreeId, tabId } : null
    const left = previous.current
    previous.current = now
    if (!enabled) {
      return
    }
    if (now && isAgentHubTabAutoPopout(now.tabId)) {
      closeAgentHubMirrorChipsOfTab(now.tabId)
    }
    if (
      !left ||
      left.tabId === now?.tabId ||
      left.worktreeId === FLOATING_TERMINAL_WORKTREE_ID ||
      !isAgentHubTabAutoPopout(left.tabId)
    ) {
      return
    }
    // Why the hub's own tree: it already resolves a tab to its workspace (worktree or folder),
    // project and agent pane. A closed tab is not in it, so nothing is parked for one.
    const row = agentHubRowOfTab(
      agentHubTerminalTreeFromState(
        useAppStore.getState(),
        latest.current.threads,
        true,
        latest.current.parentOf
      ),
      left.tabId
    )
    if (row) {
      parkAgentHubMirror(paneTargetFromTerminalRow(row))
    }
  }, [onScreen, enabled])
}
