import { useCallback, useLayoutEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import {
  setAgentHubTerminalPortals,
  type ActivityTerminalPortalTarget
} from '../activity/terminal-portal/activity-terminal-portal'
import { isTerminalSourceVisible } from '../terminal-pane/terminal-source-visibility'
import { useAgentHubBorrowedTabs } from './agent-hub-borrowed-tabs'
import { setAgentHubChatDestinations } from './agent-hub-chat-destinations'
import { isAgentHubChatTab } from './agent-hub-chat-tabs'
import {
  activeAgentHubMirrorTab,
  shownAgentHubMirrorTarget,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import { useAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { agentHubMirrorShellLeafId } from './agent-hub-mirror-source'

type MirrorSurface = 'portal' | 'in-workspace' | 'preview' | 'chat'

/** Decides what each mirror window shows and moves that pane or chat into the window's slot. */
export function useAgentHubMirrorSurfaces({
  windows,
  slots,
  onCanvas,
  hubOpen,
  quiet,
  hidden
}: {
  windows: readonly AgentHubMirrorWindowState[]
  slots: ReadonlyMap<string, HTMLElement>
  onCanvas: boolean
  hubOpen: boolean
  quiet: boolean
  hidden: boolean
}): readonly { surface: MirrorSurface; paneKey: string | null }[] {
  const selection = useAgentHubMirrorSelection()
  const borrowed = useAgentHubBorrowedTabs()
  // The pane each window shows (a shell target follows its tab's active pane), and whether
  // that tab is on screen in the workspace right now — the pane can only be in one place.
  const placement = useAppStore(
    useShallow((state) =>
      windows.map((window) => {
        const target = shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window))
        const leafId = agentHubMirrorShellLeafId(state.terminalLayoutsByTabId[target.tab.id])
        const paneKey = target.paneKey ?? (leafId ? makePaneKey(target.tab.id, leafId) : null)
        const onScreen =
          !borrowed.some(
            (tab) => tab.tabId === target.tab.id && tab.worktreeId === target.worktree.id
          ) && isTerminalSourceVisible(state, target.worktree.id, target.tab.id, onCanvas)
        const chat = isAgentHubChatTab(state, target.tab.id)
        return `${paneKey ?? ''}\u0000${onScreen ? '1' : '0'}\u0000${chat ? '1' : '0'}`
      })
    )
  )
  const surfaces = useMemo(
    () =>
      windows.map((window, index): { surface: MirrorSurface; paneKey: string | null } => {
        const target = shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window))
        const [paneKey = '', onScreen, chat] = (placement[index] ?? '').split('\u0000')
        if (target.worktree.id === FLOATING_TERMINAL_WORKTREE_ID) {
          // The floating panel draws its own terminals; the dashboard preview stands in.
          return { surface: 'preview', paneKey: paneKey || null }
        }
        if (onScreen === '1') {
          return { surface: 'in-workspace', paneKey: paneKey || null }
        }
        return { surface: chat === '1' ? 'chat' : 'portal', paneKey: paneKey || null }
      }),
    [windows, placement]
  )
  // Only the front window's pane takes keyboard focus on arrival.
  const takesKeyboard = useCallback(
    (window: AgentHubMirrorWindowState, index: number): boolean =>
      selection.windowId === window.id &&
      selection.tabId === window.activeTabId &&
      selection.focusTerminal &&
      index === windows.length - 1 &&
      !hubOpen &&
      !quiet &&
      !hidden,
    [selection, windows.length, hubOpen, quiet, hidden]
  )
  const portals = useMemo(
    () =>
      windows.flatMap((window, index): ActivityTerminalPortalTarget[] => {
        const target = shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window))
        const key = window.id
        const slot = slots.get(key)
        const { surface, paneKey } = surfaces[index] ?? { surface: 'portal', paneKey: null }
        if (surface !== 'portal' || !slot || !paneKey) {
          return []
        }
        return [
          {
            owner: 'agent-hub',
            priority: index,
            slotId: `agent-hub:${key}`,
            requestToken: `agent-hub:${key}:${paneKey}`,
            target: slot,
            worktreeId: target.worktree.id,
            tabId: target.tab.id,
            paneKey,
            active: takesKeyboard(window, index)
          }
        ]
      }),
    [windows, slots, surfaces, takesKeyboard]
  )
  const chatDestinations = useMemo(
    () =>
      windows.flatMap((window, index) => {
        const element = slots.get(window.id)
        return surfaces[index]?.surface === 'chat' && element
          ? [
              {
                tabId: shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window)).tab.id,
                element,
                visible: !hidden,
                focused: takesKeyboard(window, index)
              }
            ]
          : []
      }),
    [windows, slots, surfaces, hidden, takesKeyboard]
  )
  useLayoutEffect(() => {
    setAgentHubChatDestinations(chatDestinations)
  }, [chatDestinations])
  useLayoutEffect(() => () => setAgentHubChatDestinations([]), [])
  // Why layout: publish before paint so the pane moves in the same frame the window opens.
  useLayoutEffect(() => {
    setAgentHubTerminalPortals(portals)
  }, [portals])
  useLayoutEffect(() => () => setAgentHubTerminalPortals([]), [])
  return surfaces
}
