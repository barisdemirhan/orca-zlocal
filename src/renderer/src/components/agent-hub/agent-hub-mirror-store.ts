import { useSyncExternalStore } from 'react'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'

type Point = { x: number; y: number }

/** A minimized mirror: a small chip that stays on screen until the user restores or closes it. */
export type AgentHubMirrorChip = { target: AgentHubPaneTarget } & Point

export type AgentHubMirrorState = {
  /** Open mirror windows, back to front. */
  windows: readonly AgentHubPaneTarget[]
  chips: readonly AgentHubMirrorChip[]
}

// Each open window is a live terminal; past this the back-most one shrinks into its chip.
export const MAX_AGENT_HUB_MIRROR_WINDOWS = 4
const MAX_CHIPS = 8
const CHIP_STEP_Y = 40
const CHIP_OVERLAP_X = 160
const FALLBACK_ORIGIN: Point = { x: 16, y: 16 }

let state: AgentHubMirrorState = { windows: [], chips: [] }
// Where each window sits, so it minimizes in place. Not rendered state.
const windowOrigins = new Map<string, Point>()
const listeners = new Set<() => void>()

function emit(next: AgentHubMirrorState): void {
  state = next
  listeners.forEach((listener) => listener())
}

const keyOf = agentHubPaneTargetKey

export function rememberAgentHubMirrorOrigin(key: string, origin: Point): void {
  windowOrigins.set(key, origin)
}

/** Where a window last stood, for a window reopening at its chip's spot. */
export function readAgentHubMirrorOrigin(key: string): Point | null {
  return windowOrigins.get(key) ?? null
}

/** Chips start where their window was; one already there pushes the newcomer down a step. */
function placeChip(chips: readonly AgentHubMirrorChip[], origin: Point): Point {
  let { y } = origin
  while (
    chips.some(
      (chip) => Math.abs(chip.y - y) < CHIP_STEP_Y && Math.abs(chip.x - origin.x) < CHIP_OVERLAP_X
    )
  ) {
    y += CHIP_STEP_Y
  }
  return { x: origin.x, y }
}

function withChip(
  chips: readonly AgentHubMirrorChip[],
  target: AgentHubPaneTarget
): AgentHubMirrorChip[] {
  const key = keyOf(target)
  const others = chips.filter((chip) => keyOf(chip.target) !== key)
  const origin = windowOrigins.get(key) ?? FALLBACK_ORIGIN
  return [...others, { target, ...placeChip(others, origin) }].slice(-MAX_CHIPS)
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

export function restoreAgentHubMirror(key: string): void {
  const chip = state.chips.find((candidate) => keyOf(candidate.target) === key)
  if (chip) {
    // The window comes back where its chip was dragged to.
    windowOrigins.set(key, { x: chip.x, y: chip.y })
    emit(showWindow(state.windows, state.chips, chip.target))
  }
}

export function closeAgentHubMirror(key: string): void {
  if (state.windows.some((open) => keyOf(open) === key)) {
    emit({ ...state, windows: state.windows.filter((open) => keyOf(open) !== key) })
  }
}

export function closeAgentHubMirrorChip(key: string): void {
  emit({ ...state, chips: state.chips.filter((chip) => keyOf(chip.target) !== key) })
}

export function moveAgentHubMirrorChip(key: string, position: Point): void {
  emit({
    ...state,
    chips: state.chips.map((chip) => (keyOf(chip.target) === key ? { ...chip, ...position } : chip))
  })
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
