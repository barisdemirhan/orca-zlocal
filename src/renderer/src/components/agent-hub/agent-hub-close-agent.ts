import { closeTerminalTab } from '../terminal/terminal-tab-actions'
import { guardRunningTerminalClose } from '../terminal/running-terminal-close-guard'
import { applyClosedTerminalLeafNotice } from '../terminal-pane/closed-terminal-leaf-notice'
import { requestActiveTerminalPaneClose } from '../terminal-pane/request-active-terminal-pane-close'
import { closeWebRuntimeTerminal } from '@/runtime/web-runtime-session'
import { useAppStore } from '@/store'
import { useRunningTerminalCloseConfirmStore } from '@/store/running-terminal-close-confirm'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { TerminalPaneLayoutNode } from '../../../../shared/terminal-tab-types'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function countLeaves(node: TerminalPaneLayoutNode | null | undefined): number {
  if (!node) {
    return 0
  }
  return node.type === 'leaf' ? 1 : countLeaves(node.first) + countLeaves(node.second)
}

/** A mounted pane runs its full user-close path; an unmounted one has its PTY stopped here. */
function closeSplitLeaf(tabId: string, leafId: string, title: string, confirmed: boolean): void {
  if (requestActiveTerminalPaneClose(tabId, { leafId, confirm: !confirmed })) {
    return
  }
  const close = (): void => {
    const ptyId = useAppStore.getState().terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId?.[leafId]
    if (ptyId && !closeWebRuntimeTerminal(ptyId)) {
      void window.api.pty.kill(ptyId).catch(() => {})
    }
    applyClosedTerminalLeafNotice(tabId, leafId)
  }
  if (confirmed) {
    close()
  } else {
    guardRunningTerminalClose({ terminalTabId: tabId, tabLabel: title, onClose: close })
  }
}

/** Closes one pane or tab, preserving the running-process guard until the user confirms. */
export function closeAgentHubAgent(
  target: AgentHubPaneTarget,
  kind: AgentHubIndicatorKind | null
): void {
  const tabId = target.tab.id
  const leafId = target.paneKey ? (parsePaneKey(target.paneKey)?.leafId ?? null) : null
  const layout = useAppStore.getState().terminalLayoutsByTabId[tabId]
  const splitLeaf = leafId !== null && countLeaves(layout?.root) > 1 ? leafId : null

  const close = (confirmed: boolean): void => {
    if (splitLeaf) {
      closeSplitLeaf(tabId, splitLeaf, target.title, confirmed)
      return
    }
    closeTerminalTab(tabId, { skipRunningProcessConfirm: confirmed })
  }

  const skipConfirm = useAppStore.getState().settings?.skipCloseTerminalWithRunningProcessConfirm
  if ((kind === 'work' || kind === 'ask') && skipConfirm !== true) {
    useRunningTerminalCloseConfirmStore.getState().requestRunningTerminalCloseConfirm({
      terminalTabId: tabId,
      tabLabel: target.title,
      copyKind: 'agent',
      onConfirm: () => close(true)
    })
    return
  }
  close(false)
}
