import { closeTerminalTab } from '../terminal/terminal-tab-actions'
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
function closeSplitLeaf(tabId: string, leafId: string): void {
  if (requestActiveTerminalPaneClose(tabId, { leafId, confirm: false })) {
    return
  }
  const ptyId = useAppStore.getState().terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId?.[leafId]
  if (ptyId && !closeWebRuntimeTerminal(ptyId)) {
    void window.api.pty.kill(ptyId).catch(() => {})
  }
  applyClosedTerminalLeafNotice(tabId, leafId)
}

/**
 * Ends one agent (or shell) from the hub: its pane when the tab is split, so siblings survive,
 * else the whole tab. A working or waiting agent asks first; an idle or finished one does not.
 */
export function closeAgentHubAgent(
  target: AgentHubPaneTarget,
  kind: AgentHubIndicatorKind | null
): void {
  const tabId = target.tab.id
  const leafId = target.paneKey ? (parsePaneKey(target.paneKey)?.leafId ?? null) : null
  const layout = useAppStore.getState().terminalLayoutsByTabId[tabId]
  const splitLeaf = leafId !== null && countLeaves(layout?.root) > 1 ? leafId : null

  const close = (): void => {
    if (splitLeaf) {
      closeSplitLeaf(tabId, splitLeaf)
      return
    }
    // Why: confirmation already happened (or is not wanted); the pinned-tab guard still applies.
    closeTerminalTab(tabId, { skipRunningProcessConfirm: true })
  }

  const skipConfirm = useAppStore.getState().settings?.skipCloseTerminalWithRunningProcessConfirm
  if ((kind === 'work' || kind === 'ask') && skipConfirm !== true) {
    useRunningTerminalCloseConfirmStore.getState().requestRunningTerminalCloseConfirm({
      terminalTabId: tabId,
      tabLabel: target.title,
      copyKind: 'agent',
      onConfirm: close
    })
    return
  }
  close()
}
