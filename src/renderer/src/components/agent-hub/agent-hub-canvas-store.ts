import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { endAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import {
  agentHubMirrorWindowCap,
  focusAgentHubMirror,
  readAgentHubMirrors,
  requestAgentHubMirrorsDock,
  restoreAgentHubMirrors
} from './agent-hub-mirror-store'

// Focus inside these stays put when the canvas opens; anywhere else it is behind the canvas.
const OVER_THE_CANVAS =
  '[data-agent-hub-panel], [data-agent-hub-dock], [data-floating-terminal-panel]'

// Whether the canvas (the page mirrors live on while its setting is on) is showing.
let open = false
// The mirrors on the canvas when it was last left, front first; they come back with it.
let parked: readonly string[] = []
// The right sidebar as it was before the canvas closed it.
let rightSidebarWasOpen = false
let stopGuarding: (() => void) | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeAgentHubCanvas(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isAgentHubCanvasOpen(): boolean {
  return open
}

export function useAgentHubCanvasOpen(): boolean {
  return useSyncExternalStore(subscribeAgentHubCanvas, isAgentHubCanvasOpen)
}

/**
 * While the canvas is up: going to another page or workspace leaves it, and the right sidebar
 * stays closed whoever asks for it (its toggle, a shortcut, a flow that reveals a panel).
 */
function guardShell(): () => void {
  const { activeView, activeWorktreeId } = useAppStore.getState()
  return useAppStore.subscribe((state) => {
    if (state.activeView !== activeView || state.activeWorktreeId !== activeWorktreeId) {
      closeAgentHubCanvas()
    } else if (state.rightSidebarOpen) {
      state.setRightSidebarOpen(false)
    }
  })
}

/** The mirrors the last leave parked, front first; they come back when the canvas does. */
export function readAgentHubCanvasParked(): readonly string[] {
  return parked
}

/** The last session left the canvas with these mirrors parked: the next visit brings them back. */
export function rememberAgentHubCanvasParked(keys: readonly string[]): void {
  if (!open) {
    parked = keys
  }
}

/** The mirrors parked by the last leave return to their places, behind any opened just now. */
function bringParkedMirrorsBack(): void {
  const { windows, chips } = readAgentHubMirrors()
  const room = agentHubMirrorWindowCap() - windows.length
  const back = parked
    .filter((key) => chips.some((chip) => chip.window.id === key))
    .slice(0, Math.max(0, room))
  parked = []
  if (back.length === 0) {
    return
  }
  const front = windows.at(-1)
  restoreAgentHubMirrors(back)
  if (front) {
    focusAgentHubMirror(front.id)
  }
}

export function openAgentHubCanvas(preserveKeyboardFocus = false): void {
  if (open) {
    return
  }
  open = true
  const app = useAppStore.getState()
  rightSidebarWasOpen = app.rightSidebarOpen
  if (rightSidebarWasOpen) {
    app.setRightSidebarOpen(false)
  }
  stopGuarding = guardShell()
  bringParkedMirrorsBack()
  // Why: keys must not reach a terminal or editor the canvas now hides.
  const focused = document.activeElement
  if (
    !preserveKeyboardFocus &&
    focused instanceof HTMLElement &&
    !focused.closest(OVER_THE_CANVAS)
  ) {
    focused.blur()
  }
  emit()
}

/** Leaves the canvas: its mirrors fly to the tray and the right sidebar returns as it was. */
export function closeAgentHubCanvas(): void {
  if (!open) {
    return
  }
  open = false
  // Focus is the canvas's: the mirror flies to the tray from its own place.
  endAgentHubMirrorFocus()
  stopGuarding?.()
  stopGuarding = null
  parked = readAgentHubMirrors()
    .windows.map((window) => window.id)
    .toReversed()
  requestAgentHubMirrorsDock()
  if (rightSidebarWasOpen) {
    useAppStore.getState().setRightSidebarOpen(true)
  }
  emit()
}

export function toggleAgentHubCanvas(): void {
  if (open) {
    closeAgentHubCanvas()
  } else {
    openAgentHubCanvas()
  }
}

/** Test seam: closed, with nothing remembered. */
export function resetAgentHubCanvasForTest(): void {
  closeAgentHubCanvas()
  parked = []
  rightSidebarWasOpen = false
}
