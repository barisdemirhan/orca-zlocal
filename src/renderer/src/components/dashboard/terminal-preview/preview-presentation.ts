import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { DashboardCardTerminalInput } from '../../../../../shared/agent-status/presentation/dashboard-snapshot'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import { buildPreviewAppearanceOptions } from '../../standalone-terminal/rendering/preview-terminal-options'
import { syncPreviewTerminalLigatures } from '../../standalone-terminal/rendering/preview-terminal-ligatures'

type PreviewPresentation = { visible: boolean; focusOnActivate: boolean | undefined }

export function usePreviewPresentation(visible: boolean, focusOnActivate: boolean | undefined) {
  const presentationRef = useRef<PreviewPresentation>({ visible, focusOnActivate })
  const activateRef = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    presentationRef.current = { visible, focusOnActivate }
    if (visible) {
      activateRef.current?.()
    }
  }, [visible, focusOnActivate])
  return { presentationRef, activateRef }
}

export function createPreviewActivation(
  presentation: React.RefObject<PreviewPresentation>,
  getTerminal: () => Terminal | null,
  boxFit: { schedule: () => void },
  gridClaim: { schedule: () => void }
): () => void {
  return () => {
    boxFit.schedule()
    gridClaim.schedule()
    if (presentation.current.focusOnActivate !== false) {
      getTerminal()?.focus()
    }
  }
}

export function focusPreviewAfterReplay(
  presentation: PreviewPresentation,
  terminal: Terminal,
  replaceExisting: boolean
): void {
  if (
    (!replaceExisting || presentation.focusOnActivate === undefined) &&
    presentation.visible &&
    presentation.focusOnActivate !== false
  ) {
    terminal.focus()
  }
}

export type AgentTerminalPreviewProps = {
  ptyId: string
  terminalInput?: DashboardCardTerminalInput | null
  visible?: boolean
  focusOnActivate?: boolean
  className?: string
  onRequestClose?: () => void
}

export function observePreviewBox(
  container: HTMLElement,
  boxFit: { schedule: () => void },
  gridClaim: { schedule: () => void }
): ResizeObserver | null {
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          boxFit.schedule()
          gridClaim.schedule()
        })
  if (container.parentElement) {
    observer?.observe(container.parentElement)
  }
  observer?.observe(container)
  return observer
}

export function usePreviewAppearance(
  terminalRef: React.RefObject<Terminal | null>,
  settings: GlobalSettings | null,
  macOptionIsMeta: boolean,
  fontReady?: boolean
): void {
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    Object.assign(terminal.options, buildPreviewAppearanceOptions(settings, macOptionIsMeta))
    syncPreviewTerminalLigatures(terminal, settings)
  }, [terminalRef, settings, macOptionIsMeta, fontReady])
}
