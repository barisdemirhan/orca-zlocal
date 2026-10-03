import { useSyncExternalStore } from 'react'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'

type Point = { x: number; y: number }

/** A minimized mirror, parked in the tray beside the hub until restored or closed. */
export type AgentHubMirrorChip = { target: AgentHubPaneTarget; minimizedAt: number }

export type AgentHubMirrorState = {
  /** Open mirror windows, back to front. */
  windows: readonly AgentHubPaneTarget[]
  chips: readonly AgentHubMirrorChip[]
}

// Each open window is a live terminal; past this the back-most one shrinks into its chip.
export const MAX_AGENT_HUB_MIRROR_WINDOWS = 4
const MAX_CHIPS = 12

let state: AgentHubMirrorState = { windows: [], chips: [] }
// Where each window sat, so it comes back there from the tray. Not rendered state.
const windowOrigins = new Map<string, Point>()
const listeners = new Set<() => void>()
// Bumped to ask every open window to fly into the tray; each minimizes itself on landing.
let dockRequest = 0
const dockListeners = new Set<() => void>()

function emit(next: AgentHubMirrorState): void {
  state = next
  listeners.forEach((listener) => listener())
}

const keyOf = agentHubPaneTargetKey

export function rememberAgentHubMirrorOrigin(key: string, origin: Point): void {
  windowOrigins.set(key, origin)
}

/** Where a window last stood, so it reopens there from the tray. */
export function readAgentHubMirrorOrigin(key: string): Point | null {
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
  while (nextWindows.length > MAX_AGENT_HUB_MIRROR_WINDOWS) {
    const evicted = nextWindows.shift()
    if (evicted) {
      nextChips = withChip(nextChips, evicted)
    }
  }
  return { windows: nextWindows, chips: nextChips }
}

/** Opens a pane's mirror, or brings its open window (or its chip) back to the front. */
export function openAgentHubMirror(target: AgentHubPaneTarget): void {
  emit(showWindow(state.windows, state.chips, target))
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
  }
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

export function minimizeAgentHubMirror(key: string): void {
  const target = state.windows.find((open) => keyOf(open) === key)
  if (target) {
    emit({
      windows: state.windows.filter((open) => open !== target),
      chips: withChip(state.chips, target)
    })
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
  for (const key of keys.slice(0, MAX_AGENT_HUB_MIRROR_WINDOWS).toReversed()) {
    const chip = next.chips.find((candidate) => keyOf(candidate.target) === key)
    if (chip) {
      next = showWindow(next.windows, next.chips, chip.target)
    }
  }
  if (next !== state) {
    emit(next)
  }
}

/** Asks every open window to fly into the tray. */
export function requestAgentHubMirrorsDock(): void {
  dockRequest += 1
  dockListeners.forEach((listener) => listener())
}

function subscribeDock(listener: () => void): () => void {
  dockListeners.add(listener)
  return () => dockListeners.delete(listener)
}

export function useAgentHubMirrorsDockRequest(): number {
  return useSyncExternalStore(subscribeDock, () => dockRequest)
}

export function closeAgentHubMirror(key: string): void {
  if (state.windows.some((open) => keyOf(open) === key)) {
    emit({ ...state, windows: state.windows.filter((open) => keyOf(open) !== key) })
  }
}

export function closeAgentHubMirrorChip(key: string): void {
  emit({ ...state, chips: state.chips.filter((chip) => keyOf(chip.target) !== key) })
}

/** Test seam: start every case from an empty stage. */
export function resetAgentHubMirrorsForTest(): void {
  windowOrigins.clear()
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
