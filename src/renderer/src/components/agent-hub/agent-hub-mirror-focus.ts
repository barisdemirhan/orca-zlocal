import { useSyncExternalStore } from 'react'
import { agentHubMirrorGestureOwner } from './agent-hub-mirror-gesture'

/** How a mirror stands while one is focused: the one brought forward, or one left in shadow. */
export type AgentHubMirrorFocusState = 'focused' | 'shadowed' | null

// The mirror brought forward on the canvas, enlarged over the others; they sit in shadow meanwhile.
// Only its key lives here: the box it shows in is derived, so its own place is never overwritten.
let focusedKey: string | null = null
const listeners = new Set<() => void>()

function setFocusedKey(next: string | null): void {
  if (focusedKey !== next) {
    focusedKey = next
    listeners.forEach((listener) => listener())
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readAgentHubMirrorFocus(): string | null {
  return focusedKey
}

export function useAgentHubMirrorFocus(): string | null {
  return useSyncExternalStore(subscribe, readAgentHubMirrorFocus)
}

/** Callers bring the window to the front first (see toggleAgentHubMirrorFocus). */
export function setAgentHubMirrorFocus(key: string): void {
  setFocusedKey(key)
}

export function endAgentHubMirrorFocus(): void {
  setFocusedKey(null)
}

/**
 * The focused mirror is always the front window, so whatever changes the front (a mirror
 * opening, closing, minimizing or coming forward) ends the focus.
 */
export function holdAgentHubMirrorFocusOn(frontKey: string | null): void {
  if (focusedKey !== null && focusedKey !== frontKey) {
    setFocusedKey(null)
  }
}

/** The focused window now shows another pane (a worker of the same agent): the focus follows. */
export function moveAgentHubMirrorFocus(fromKey: string, toKey: string): void {
  if (focusedKey === fromKey) {
    setFocusedKey(toKey)
  }
}

/**
 * Whether this Escape ends the focus: pressed with nothing focused, or on the canvas or a
 * mirror's own chrome. Typed in a terminal it is the agent's, and in the hub's panel or a menu
 * it closes that.
 */
export function isAgentHubMirrorFocusEscape(event: KeyboardEvent): boolean {
  const target = event.target
  if (
    event.key !== 'Escape' ||
    event.defaultPrevented ||
    agentHubMirrorGestureOwner() !== null ||
    !(target instanceof Element)
  ) {
    return false
  }
  const onStage =
    target === document.body ||
    target.closest('[data-agent-hub-mirror], [data-agent-hub-canvas]') !== null
  return onStage && target.closest('.xterm') === null
}
