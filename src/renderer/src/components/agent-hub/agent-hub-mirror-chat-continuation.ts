import { useAppStore } from '@/store'
import { isTerminalSourceVisible } from '../terminal-pane/terminal-source-visibility'
import { borrowAgentHubTab, readAgentHubBorrowedTab } from './agent-hub-borrowed-tabs'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { agentHubChatTerminalTab, findAgentHubChatTab } from './agent-hub-chat-tabs'
import {
  agentHubMirrorWindows,
  replaceAgentHubMirrorWindow,
  type AgentHubMirrorTab
} from './agent-hub-mirror-membership'
import { requestAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { commitAgentHubMirrorState, readAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function isTerminal(target: AgentHubPaneTarget, worktreeId: string, tabId: string): boolean {
  return target.worktree.id === worktreeId && target.tab.id === tabId
}

/** A mirror shows this terminal instead of the workspace. */
function agentHubMirrorHoldsTerminal(worktreeId: string, tabId: string): boolean {
  const mirrored = agentHubMirrorWindows(readAgentHubMirrors()).some((window) =>
    window.tabs.some(
      (tab) =>
        isTerminal(tab.target, worktreeId, tabId) ||
        (tab.viewing && isTerminal(tab.viewing, worktreeId, tabId))
    )
  )
  return (
    mirrored &&
    (readAgentHubBorrowedTab(tabId, worktreeId) !== null ||
      !isTerminalSourceVisible(useAppStore.getState(), worktreeId, tabId, isAgentHubCanvasOpen()))
  )
}

/** While a mirror holds the terminal, its chat opens there and the workspace keeps what it shows. */
export function agentHubMirrorChatPlacement(
  worktreeId: string,
  tabId: string
): { activate?: false } {
  return agentHubMirrorHoldsTerminal(worktreeId, tabId) ? { activate: false } : {}
}

/** The workspace gets the chat when the terminal closes, unless the mirror had borrowed its tab. */
function keepChatBorrowed(worktreeId: string, chatTabId: string, mirrorKey: string): void {
  const stop = useAppStore.subscribe((state) => {
    const chat = state.unifiedTabsByWorktree[worktreeId]?.find((tab) => tab.id === chatTabId)
    const group = state.groupsByWorktree[worktreeId]?.find((item) => item.id === chat?.groupId)
    if (!chat || !group) {
      stop()
    } else if (group.activeTabId === chatTabId) {
      stop()
      borrowAgentHubTab({
        worktreeId,
        tabId: chatTabId,
        unifiedTabId: chatTabId,
        groupId: group.id,
        mirrorKey
      })
    }
  })
}

/** Called as the terminal closes, so its mirror entries are never seen pointing at nothing. */
export function moveAgentHubMirrorToChat(
  worktreeId: string,
  terminalTabId: string,
  chatTabId: string
): void {
  const chat = findAgentHubChatTab(useAppStore.getState(), chatTabId)
  if (!chat) {
    return
  }
  const borrowed = readAgentHubBorrowedTab(terminalTabId, worktreeId)
  const tab = agentHubChatTerminalTab(chat)
  const moved = (target: AgentHubPaneTarget): AgentHubPaneTarget =>
    isTerminal(target, worktreeId, terminalTabId) ? { ...target, tab, paneKey: null } : target
  const state = readAgentHubMirrors()
  let next = state
  const focus: { windowId: string; tabId: string }[] = []
  for (const window of agentHubMirrorWindows(state)) {
    const tabs = window.tabs.map((entry): AgentHubMirrorTab => {
      const target = moved(entry.target)
      const viewing = entry.viewing ? moved(entry.viewing) : undefined
      if (target === entry.target && viewing === entry.viewing) {
        return entry
      }
      if (entry.id === window.activeTabId) {
        focus.push({ windowId: window.id, tabId: entry.id })
      }
      return { ...entry, target, ...(viewing ? { viewing } : {}) }
    })
    if (tabs.some((entry, index) => entry !== window.tabs[index])) {
      next = replaceAgentHubMirrorWindow(next, window.id, { ...window, tabs })
    }
  }
  if (next === state) {
    return
  }
  commitAgentHubMirrorState(next)
  for (const { windowId, tabId } of focus) {
    requestAgentHubMirrorSelection(windowId, tabId, true)
  }
  if (borrowed) {
    keepChatBorrowed(worktreeId, chatTabId, borrowed.mirrorKey)
  }
}
