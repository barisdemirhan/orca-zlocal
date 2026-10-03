import type { Terminal } from '@xterm/xterm'
import type { WebglAddon } from '@xterm/addon-webgl'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  getTerminalWebglAddonConstructor,
  primeTerminalWebglAddon
} from '@/lib/pane-manager/terminal-webgl-addon-loader'
import { getTerminalWebglAutoDecision } from '@/lib/pane-manager/terminal-webgl-auto-policy'

function webglAllowed(settings: GlobalSettings | null): boolean {
  const mode = settings?.terminalGpuAcceleration ?? 'auto'
  return mode === 'on' || (mode === 'auto' && getTerminalWebglAutoDecision().allowWebgl)
}

/**
 * GPU rendering for a large preview that repaints often (the Agent Hub mirror), under the same
 * GPU setting as panes. Small cards stay on the DOM renderer; a lost or refused context falls
 * back to it too. Returns the detach.
 */
export function attachPreviewTerminalWebgl(
  terminal: Terminal,
  settings: GlobalSettings | null
): () => void {
  let addon: WebglAddon | null = null
  let disposed = false
  const detach = (): void => {
    try {
      addon?.dispose()
    } catch {
      /* the context is already gone */
    }
    addon = null
  }
  const attach = (): void => {
    const Addon = getTerminalWebglAddonConstructor()
    if (disposed || !Addon || !webglAllowed(settings)) {
      return
    }
    try {
      addon = new Addon()
      addon.onContextLoss(detach)
      terminal.loadAddon(addon)
    } catch {
      detach()
    }
  }
  if (getTerminalWebglAddonConstructor()) {
    attach()
  } else {
    void primeTerminalWebglAddon().then(attach)
  }
  return () => {
    disposed = true
    detach()
  }
}
