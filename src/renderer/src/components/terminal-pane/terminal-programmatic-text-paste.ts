import type { PasteTerminalTextDetail } from '@/constants/terminal'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from './pty-transport-types'
import { getShortcutPlatform } from '@/lib/shortcut-platform'
import { recordTerminalUserInputForLeaf } from './terminal-input-activity'
import { pasteTextIntoTerminalPane } from './terminal-pane-paste-dispatch'
import { resolveTerminalPasteRuntime } from './terminal-paste-runtime'
import { isTerminalPanePasteTargetCurrent } from './terminal-paste-target-state'

type HandleTerminalProgrammaticTextPasteArgs = {
  detail: PasteTerminalTextDetail | undefined
  tabId: string
  getManager: () => PaneManager | null
  getPaneTransports: () => Map<number, PtyTransport>
  shouldFocusAfterPaste?: () => boolean
  onFinished?: () => void
}

export function handleTerminalProgrammaticTextPaste({
  detail,
  tabId,
  getManager,
  getPaneTransports,
  shouldFocusAfterPaste = () => true,
  onFinished = () => {}
}: HandleTerminalProgrammaticTextPasteArgs): void {
  if (!detail?.tabId || detail.tabId !== tabId || !detail.text) {
    onFinished()
    return
  }
  const manager = getManager()
  if (!manager) {
    onFinished()
    return
  }
  const panes = manager.getPanes()
  const pane =
    typeof detail.paneId === 'number'
      ? (panes.find((candidate) => candidate.id === detail.paneId) ?? null)
      : (manager.getActivePane() ?? panes[0])
  if (!pane) {
    onFinished()
    return
  }
  const paneTransports = getPaneTransports()
  const transport = paneTransports.get(pane.id)
  const ptyId = transport?.getPtyId() ?? null
  const isTargetCurrent = (): boolean =>
    isTerminalPanePasteTargetCurrent({
      manager: getManager(),
      paneTransports: getPaneTransports(),
      paneId: pane.id,
      leafId: pane.leafId,
      transport,
      ptyId
    })
  void pasteTextIntoTerminalPane({
    pane,
    text: detail.text,
    source: 'programmatic',
    ptyId,
    runtime: resolveTerminalPasteRuntime({
      platform: getShortcutPlatform(),
      ptyId,
      transport
    }),
    transport,
    inputKind: 'driving',
    isTargetCurrent,
    canContinue: isTargetCurrent
  }).then((result) => {
    if (result.status !== 'pasted') {
      return
    }
    recordTerminalUserInputForLeaf(tabId, pane.leafId)
    if (shouldFocusAfterPaste()) {
      pane.terminal.focus()
    }
  }).finally(onFinished)
}
