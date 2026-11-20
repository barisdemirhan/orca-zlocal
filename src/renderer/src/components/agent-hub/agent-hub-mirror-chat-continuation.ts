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
import { readAgentHubChatWorking } from './agent-hub-chat-work-state'
import { readNativeChatComposerDraft } from '../native-chat/drafts/native-chat-composer-draft-store'
import { structuredAgentSessionDraftScopeKey } from '../native-chat/drafts/native-chat-draft-scope'
import { readStructuredChatTabSavedName } from '@/runtime/native-chat/naming/structured-chat-tab-name'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'

const TERMINAL_ARRIVAL_TIMEOUT_MS = 5000

function isTab(target: AgentHubPaneTarget, worktreeId: string, tabId: string): boolean {
  return target.worktree.id === worktreeId && target.tab.id === tabId
}

/** A mirror shows this tab instead of the workspace. */
function agentHubMirrorHoldsTerminal(worktreeId: string, tabId: string): boolean {
  const mirrored = agentHubMirrorWindows(readAgentHubMirrors()).some((window) =>
    window.tabs.some(
      (tab) =>
        isTab(tab.target, worktreeId, tabId) ||
        (tab.viewing && isTab(tab.viewing, worktreeId, tabId))
    )
  )
  return (
    mirrored &&
    (readAgentHubBorrowedTab(tabId, worktreeId) !== null ||
      !isTerminalSourceVisible(useAppStore.getState(), worktreeId, tabId, isAgentHubCanvasOpen()))
  )
}

/** While a mirror holds the tab, its successor opens there and the workspace keeps what it shows. */
export function agentHubMirrorChatPlacement(
  worktreeId: string,
  tabId: string
): { activate?: false } {
  return agentHubMirrorHoldsTerminal(worktreeId, tabId) ? { activate: false } : {}
}

/** The workspace gets the successor when the old tab closes, unless the mirror had borrowed it. */
function keepBorrowed(worktreeId: string, tabId: string, mirrorKey: string): () => void {
  const stop = useAppStore.subscribe((state) => {
    const tab = state.unifiedTabsByWorktree[worktreeId]?.find(
      (item) => item.id === tabId || (item.contentType === 'terminal' && item.entityId === tabId)
    )
    const group = state.groupsByWorktree[worktreeId]?.find((item) => item.id === tab?.groupId)
    if (!tab || !group) {
      stop()
    } else if (group.activeTabId === tab.id) {
      stop()
      borrowAgentHubTab({
        worktreeId,
        tabId,
        unifiedTabId: tab.id,
        groupId: group.id,
        mirrorKey
      })
    }
  })
  return stop
}

function retargetAgentHubMirrors(
  worktreeId: string,
  fromTabId: string,
  tab: TerminalTab,
  title?: string
): boolean {
  const moved = (target: AgentHubPaneTarget): AgentHubPaneTarget =>
    isTab(target, worktreeId, fromTabId)
      ? { ...target, tab, paneKey: null, ...(title ? { title } : {}) }
      : target
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
    return false
  }
  commitAgentHubMirrorState(next)
  for (const { windowId, tabId } of focus) {
    requestAgentHubMirrorSelection(windowId, tabId, true)
  }
  return true
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
  if (
    retargetAgentHubMirrors(worktreeId, terminalTabId, agentHubChatTerminalTab(chat)) &&
    borrowed
  ) {
    keepBorrowed(worktreeId, chatTabId, borrowed.mirrorKey)
  }
}

/** A paired host's new tab reaches this client a moment after its create call returns. */
function terminalTabArrival(worktreeId: string, tabId: string): Promise<TerminalTab | null> {
  const find = (): TerminalTab | undefined =>
    useAppStore.getState().tabsByWorktree[worktreeId]?.find((tab) => tab.id === tabId)
  const present = find()
  if (present) {
    return Promise.resolve(present)
  }
  return new Promise((resolve) => {
    const finish = (tab: TerminalTab | null): void => {
      clearTimeout(timer)
      stop()
      resolve(tab)
    }
    const timer = setTimeout(() => finish(null), TERMINAL_ARRIVAL_TIMEOUT_MS)
    const stop = useAppStore.subscribe(() => {
      const tab = find()
      if (tab) {
        finish(tab)
      }
    })
  })
}

/** The fork replaces the chat in place; a chat still answering or holding a draft stays open. */
export async function moveAgentHubMirrorToTerminal(
  worktreeId: string,
  chatTabId: string,
  terminalTabId: string
): Promise<boolean> {
  const terminal = await terminalTabArrival(worktreeId, terminalTabId)
  const state = useAppStore.getState()
  const chat = findAgentHubChatTab(state, chatTabId)
  if (!terminal || !chat) {
    return false
  }
  const borrowed = readAgentHubBorrowedTab(chatTabId, worktreeId)
  const title = readStructuredChatTabSavedName(chat, state) ?? chat.generatedLabel ?? undefined
  if (!retargetAgentHubMirrors(worktreeId, chatTabId, terminal, title)) {
    return false
  }
  const draft = readNativeChatComposerDraft(structuredAgentSessionDraftScopeKey(chat.entityId))
  if (readAgentHubChatWorking(chatTabId) || draft.text !== '' || draft.images.length > 0) {
    return true
  }
  const stopKeeping = borrowed ? keepBorrowed(worktreeId, terminalTabId, borrowed.mirrorKey) : null
  state.closeUnifiedTab(chatTabId)
  stopKeeping?.()
  return true
}
