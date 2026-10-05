import { DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP } from '../../../../shared/agent-hub-settings'
import { useSyncExternalStore } from 'react'
import {
  endAgentHubMirrorFocus,
  holdAgentHubMirrorFocusOn,
  moveAgentHubMirrorFocus,
  readAgentHubMirrorFocus,
  setAgentHubMirrorFocus
} from './agent-hub-mirror-focus'
import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'

/** A minimized mirror, parked in the tray beside the hub until restored or closed. */
export type AgentHubMirrorChip = { target: AgentHubPaneTarget; minimizedAt: number }

export type AgentHubMirrorState = {
  /** Open mirror windows, back to front. */
  windows: readonly AgentHubPaneTarget[]
  chips: readonly AgentHubMirrorChip[]
}

// Each open window is a live terminal; past this the back-most one shrinks into its chip.
// How many windows stay open at once; the user's setting (see setAgentHubMirrorWindowCap).
let windowCap = DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP
const MAX_CHIPS = 12

let state: AgentHubMirrorState = { windows: [], chips: [] }
// Where each window sat (and how large), so it comes back there. Not rendered state.
const windowOrigins = new Map<string, AgentHubMirrorGeometry>()
// Windows the user moved, resized or arranged: their place outlives closing them.
const keptPlaces = new Set<string>()
const listeners = new Set<() => void>()
// The window last picked again from the hub while already open, so it can glow.
let highlight: { key: string; seq: number } = { key: '', seq: 0 }
const highlightListeners = new Set<() => void>()
// Asks every open window (or the one named) to fly into the tray; each minimizes itself on landing.
let dockRequest: { seq: number; key: string | null } = { seq: 0, key: null }
const dockListeners = new Set<() => void>()

function emit(next: AgentHubMirrorState): void {
  state = next
  // A focused mirror is the front window; any change of the front ends the focus.
  const front = next.windows.at(-1)
  holdAgentHubMirrorFocusOn(front ? agentHubPaneTargetKey(front) : null)
  listeners.forEach((listener) => listener())
}

const keyOf = agentHubPaneTargetKey

export function rememberAgentHubMirrorOrigin(key: string, origin: AgentHubMirrorGeometry): void {
  windowOrigins.set(key, origin)
}

/** The user chose this window's place, so it reopens there even after it is closed. */
export function keepAgentHubMirrorPlace(key: string): void {
  keptPlaces.add(key)
}

function forgetUnkeptPlace(key: string): void {
  if (!keptPlaces.has(key)) {
    windowOrigins.delete(key)
  }
}

/** Where a window last stood: it returns there from the tray, or reopens there if the user chose it. */
export function readAgentHubMirrorOrigin(key: string): AgentHubMirrorGeometry | null {
  return windowOrigins.get(key) ?? null
}

function withChip(
  chips: readonly AgentHubMirrorChip[],
  target: AgentHubPaneTarget
): AgentHubMirrorChip[] {
  const key = keyOf(target)
  const others = chips.filter((chip) => keyOf(chip.target) !== key)
  return [...others, { target, minimizedAt: Date.now() }].slice(-MAX_CHIPS)
}

/** Brings `target` to the front, shrinking the back-most window into a chip past the cap. */
function showWindow(
  windows: readonly AgentHubPaneTarget[],
  chips: readonly AgentHubMirrorChip[],
  target: AgentHubPaneTarget
): AgentHubMirrorState {
  const key = keyOf(target)
  const nextWindows = [...windows.filter((open) => keyOf(open) !== key), target]
  let nextChips = chips.filter((chip) => keyOf(chip.target) !== key)
  while (nextWindows.length > windowCap) {
    const evicted = nextWindows.shift()
    if (evicted) {
      nextChips = withChip(nextChips, evicted)
    }
  }
  return { windows: nextWindows, chips: nextChips }
}

/** Opens a pane's mirror, or brings its open window (or its chip) back to the front. */
export function openAgentHubMirror(target: AgentHubPaneTarget): void {
  const key = keyOf(target)
  const alreadyOpen = state.windows.some((open) => keyOf(open) === key)
  emit(showWindow(state.windows, state.chips, target))
  if (alreadyOpen) {
    highlight = { key, seq: highlight.seq + 1 }
    highlightListeners.forEach((listener) => listener())
  }
}

/**
 * Opens every pane at once, the first in front: as many windows as the cap allows, the rest
 * parked in the tray. Windows already open that are not among the first give way.
 */
export function openAgentHubMirrors(targets: readonly AgentHubPaneTarget[]): void {
  let next = state
  for (const target of targets.slice(windowCap)) {
    const key = keyOf(target)
    if (!next.windows.some((open) => keyOf(open) === key)) {
      next = { ...next, chips: withChip(next.chips, target) }
    }
  }
  for (const target of targets.slice(0, windowCap).toReversed()) {
    next = showWindow(next.windows, next.chips, target)
  }
  if (next !== state) {
    emit(next)
  }
}

function subscribeHighlight(listener: () => void): () => void {
  highlightListeners.add(listener)
  return () => highlightListeners.delete(listener)
}

/** Which already-open mirror the hub last asked for, and how many times it has asked. */
export function useAgentHubMirrorHighlight(): { key: string; seq: number } {
  return useSyncExternalStore(subscribeHighlight, () => highlight)
}

/** Shows another pane in the same window (a worker of the same agent, or its dispatcher). */
export function retargetAgentHubMirror(fromKey: string, target: AgentHubPaneTarget): void {
  const toKey = keyOf(target)
  const index = state.windows.findIndex((open) => keyOf(open) === fromKey)
  if (index === -1 || toKey === fromKey) {
    return
  }
  if (state.windows.some((open) => keyOf(open) === toKey)) {
    // Already open in its own window: bring that one forward instead of doubling it.
    emit(showWindow(state.windows, state.chips, target))
    return
  }
  const origin = windowOrigins.get(fromKey)
  if (origin) {
    windowOrigins.set(toKey, origin)
    if (keptPlaces.has(fromKey)) {
      keptPlaces.add(toKey)
    }
  }
  moveAgentHubMirrorFocus(fromKey, toKey)
  emit({
    windows: state.windows.map((open, position) => (position === index ? target : open)),
    chips: state.chips.filter((chip) => keyOf(chip.target) !== toKey)
  })
}

export function focusAgentHubMirror(key: string): void {
  const target = state.windows.find((open) => keyOf(open) === key)
  if (target && state.windows.at(-1) !== target) {
    emit(showWindow(state.windows, state.chips, target))
  }
}

/**
 * Brings one mirror forward on the canvas, enlarged over the others, or returns it to its place
 * when it already is. One at a time: focusing another ends the first.
 */
export function toggleAgentHubMirrorFocus(key: string): void {
  if (readAgentHubMirrorFocus() === key) {
    endAgentHubMirrorFocus()
  } else if (state.windows.some((open) => keyOf(open) === key)) {
    focusAgentHubMirror(key)
    setAgentHubMirrorFocus(key)
  }
}

export function minimizeAgentHubMirror(key: string): void {
  const target = state.windows.find((open) => keyOf(open) === key)
  if (target) {
    emit({
      windows: state.windows.filter((open) => open !== target),
      chips: withChip(state.chips, target)
    })
  }
}

/** Parks a pane in the tray without opening it first; a pane that already has a mirror is left. */
export function parkAgentHubMirror(target: AgentHubPaneTarget): void {
  const key = keyOf(target)
  const present =
    state.windows.some((open) => keyOf(open) === key) ||
    state.chips.some((chip) => keyOf(chip.target) === key)
  if (!present) {
    emit({ ...state, chips: withChip(state.chips, target) })
  }
}

/** Drops the parked mirrors of one terminal tab (the tab is on screen again). */
export function closeAgentHubMirrorChipsOfTab(tabId: string): void {
  const kept = state.chips.filter((chip) => chip.target.tab.id !== tabId)
  if (kept.length !== state.chips.length) {
    state.chips.forEach((chip) => {
      if (chip.target.tab.id === tabId) {
        forgetUnkeptPlace(keyOf(chip.target))
      }
    })
    emit({ ...state, chips: kept })
  }
}

/** Every open window into the tray at once, without the flight (see requestAgentHubMirrorsDock). */
export function minimizeAllAgentHubMirrors(): void {
  if (state.windows.length > 0) {
    emit({ windows: [], chips: state.windows.reduce(withChip, state.chips) })
  }
}

export function restoreAgentHubMirror(key: string): void {
  const chip = state.chips.find((candidate) => keyOf(candidate.target) === key)
  if (chip) {
    emit(showWindow(state.windows, state.chips, chip.target))
  }
}

/** Brings these chips back as windows, the first one in front; past the cap the rest stay. */
export function restoreAgentHubMirrors(keys: readonly string[]): void {
  let next = state
  for (const key of keys.slice(0, windowCap).toReversed()) {
    const chip = next.chips.find((candidate) => keyOf(candidate.target) === key)
    if (chip) {
      next = showWindow(next.windows, next.chips, chip.target)
    }
  }
  if (next !== state) {
    emit(next)
  }
}

/** Asks every open window, or only the one with `key`, to fly into the tray. */
export function requestAgentHubMirrorsDock(key: string | null = null): void {
  dockRequest = { seq: dockRequest.seq + 1, key }
  dockListeners.forEach((listener) => listener())
}

function subscribeDock(listener: () => void): () => void {
  dockListeners.add(listener)
  return () => dockListeners.delete(listener)
}

export function useAgentHubMirrorsDockRequest(): { seq: number; key: string | null } {
  return useSyncExternalStore(subscribeDock, () => dockRequest)
}

export function closeAgentHubMirror(key: string): void {
  if (state.windows.some((open) => keyOf(open) === key)) {
    forgetUnkeptPlace(key)
    emit({ ...state, windows: state.windows.filter((open) => keyOf(open) !== key) })
  }
}

export function closeAgentHubMirrorChip(key: string): void {
  forgetUnkeptPlace(key)
  emit({ ...state, chips: state.chips.filter((chip) => keyOf(chip.target) !== key) })
}

/** Test seam: start every case from an empty stage. */
export function agentHubMirrorWindowCap(): number {
  return windowCap
}

/** Applies the user's cap; windows past a lowered one are parked, back-most first. */
export function setAgentHubMirrorWindowCap(cap: number): void {
  windowCap = cap
  if (state.windows.length <= cap) {
    return
  }
  let chips = state.chips
  for (const evicted of state.windows.slice(0, state.windows.length - cap)) {
    chips = withChip(chips, evicted)
  }
  emit({ windows: state.windows.slice(-cap), chips })
}

export function resetAgentHubMirrorsForTest(): void {
  windowCap = DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP
  windowOrigins.clear()
  keptPlaces.clear()
  emit({ windows: [], chips: [] })
}

export function readAgentHubMirrors(): AgentHubMirrorState {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAgentHubMirrors(): AgentHubMirrorState {
  return useSyncExternalStore(subscribe, readAgentHubMirrors)
}

export type AgentHubMirrorPresence = 'window' | 'chip' | null

/** Whether the pane with this mirror key is open in a window, parked in the tray, or neither. */
export function useAgentHubMirrorPresence(key: string): AgentHubMirrorPresence {
  return useSyncExternalStore(subscribe, () =>
    state.windows.some((open) => keyOf(open) === key)
      ? 'window'
      : state.chips.some((chip) => keyOf(chip.target) === key)
        ? 'chip'
        : null
  )
}
