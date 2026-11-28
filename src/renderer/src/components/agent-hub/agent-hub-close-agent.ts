import { closeTerminalTab } from '../terminal/tab-lifecycle/terminal-tab-actions'
import { guardRunningTerminalClose } from '../terminal/tab-lifecycle/running-terminal-close-guard'
import { applyClosedTerminalLeafNotice } from '../terminal-pane/layout/close/closed-terminal-leaf-notice'
import { requestActiveTerminalPaneClose } from '../terminal-pane/layout/close/request-active-terminal-pane-close'
import { closeWebRuntimeTerminal } from '@/runtime/hosted-terminals/actions/web-runtime-terminal-close'
import { useAppStore } from '@/store'
import { useRunningTerminalCloseConfirmStore } from '@/store/slices/tabs/closing/running-terminal-close-confirm'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { TerminalPaneLayoutNode } from '../../../../shared/workspace-layout/terminal-tab-types'
import { isAgentHubChatTab } from './agent-hub-chat-tabs'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function countLeaves(node: TerminalPaneLayoutNode | null | undefined): number {
  if (!node) {
    return 0
  }
  return node.type === 'leaf' ? 1 : countLeaves(node.first) + countLeaves(node.second)
}

/** A mounted pane runs its full user-close path; an unmounted one has its PTY stopped here. */
function closeSplitLeaf(tabId: string, leafId: string, confirmed: boolean): void {
  if (requestActiveTerminalPaneClose(tabId, { leafId, confirm: !confirmed })) {
    return
  }
  const close = (): void => {
    const ptyId = useAppStore.getState().terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId?.[leafId]
    if (ptyId && !closeWebRuntimeTerminal(ptyId)) {
      void window.api.pty.kill(ptyId).catch(() => {})
    }
    applyClosedTerminalLeafNotice(tabId, leafId, 'user')
  }
  if (confirmed) {
    close()
  } else {
    guardRunningTerminalClose({ terminalTabId: tabId, onClose: close })
  }
}

/** Closes one pane or tab, preserving the running-process guard until the user confirms. */
export function closeAgentHubAgent(
  target: AgentHubPaneTarget,
  kind: AgentHubIndicatorKind | null
): void {
  const tabId = target.tab.id
  if (isAgentHubChatTab(useAppStore.getState(), tabId)) {
    useRunningTerminalCloseConfirmStore.getState().requestRunningTerminalCloseConfirm({
      terminalTabId: tabId,
      copyKind: 'agent',
      allowSkipConfirm: false,
      onConfirm: () => {
        useAppStore.getState().closeUnifiedTab(tabId)
      }
    })
    return
  }
  const leafId = target.paneKey ? (parsePaneKey(target.paneKey)?.leafId ?? null) : null
  const layout = useAppStore.getState().terminalLayoutsByTabId[tabId]
  const splitLeaf = leafId !== null && countLeaves(layout?.root) > 1 ? leafId : null

  const close = (confirmed: boolean): void => {
    if (splitLeaf) {
      closeSplitLeaf(tabId, splitLeaf, confirmed)
      return
    }
    closeTerminalTab(tabId, { reason: 'user', skipRunningProcessConfirm: confirmed })
  }

  const skipConfirm = useAppStore.getState().settings?.skipCloseTerminalWithRunningProcessConfirm
  const isAgent = target.agentType !== null
  if (isAgent || ((kind === 'work' || kind === 'ask') && skipConfirm !== true)) {
    useRunningTerminalCloseConfirmStore.getState().requestRunningTerminalCloseConfirm({
      terminalTabId: tabId,
      copyKind: 'agent',
      allowSkipConfirm: !isAgent,
      onConfirm: () => close(true)
    })
    return
  }
  close(false)
}
