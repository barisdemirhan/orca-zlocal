import { useSyncExternalStore } from 'react'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'

/** A minimized mirror: a small chip that stays on screen until the user restores or closes it. */
export type AgentHubMirrorChip = { target: AgentHubPaneTarget; x: number; y: number }

export type AgentHubMirrorState = {
  /** The one expanded mirror window. */
  open: AgentHubPaneTarget | null
  /** True once the open mirror was minimized before: replacing it minimizes it again, never drops it. */
  openKept: boolean
  chips: readonly AgentHubMirrorChip[]
}

const MAX_CHIPS = 8
const CHIP_STEP_Y = 40
const CHIP_OVERLAP_X = 160

let state: AgentHubMirrorState = { open: null, openKept: false, chips: [] }
// Where the open window sits; a kept window pushed aside becomes a chip there. Not rendered state.
let windowOrigin = { x: 16, y: 16 }
const listeners = new Set<() => void>()

export function rememberAgentHubMirrorOrigin(origin: { x: number; y: number }): void {
  windowOrigin = origin
}

function emit(next: AgentHubMirrorState): void {
  state = next
  listeners.forEach((listener) => listener())
}

function keyOf(target: AgentHubPaneTarget): string {
  return agentHubPaneTargetKey(target)
}

/** Chips start where their window was; one already there pushes the newcomer down a step. */
function placeChip(
  chips: readonly AgentHubMirrorChip[],
  origin: { x: number; y: number }
): { x: number; y: number } {
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
  target: AgentHubPaneTarget,
  origin: { x: number; y: number }
): AgentHubMirrorChip[] {
  const others = chips.filter((chip) => keyOf(chip.target) !== keyOf(target))
  return [...others, { target, ...placeChip(others, origin) }].slice(-MAX_CHIPS)
}

/** Opens a pane's mirror from the hub; a minimized chip for the same pane is restored instead. */
export function openAgentHubMirror(target: AgentHubPaneTarget): void {
  const key = keyOf(target)
  const chip = state.chips.find((candidate) => keyOf(candidate.target) === key)
  let chips = state.chips.filter((candidate) => keyOf(candidate.target) !== key)
  if (state.open && state.openKept && keyOf(state.open) !== key) {
    chips = withChip(chips, state.open, windowOrigin)
  }
  const reopened = state.open !== null && keyOf(state.open) === key && state.openKept
  emit({ open: target, openKept: chip !== undefined || reopened, chips })
}

export function minimizeAgentHubMirror(): void {
  if (state.open) {
    emit({ open: null, openKept: false, chips: withChip(state.chips, state.open, windowOrigin) })
  }
}

/** The restored chip's window takes the stage; a kept window in its way swaps into the chip's spot. */
export function restoreAgentHubMirror(key: string): void {
  const chip = state.chips.find((candidate) => keyOf(candidate.target) === key)
  if (!chip) {
    return
  }
  let chips = state.chips.filter((candidate) => candidate !== chip)
  if (state.open && state.openKept) {
    chips = withChip(chips, state.open, { x: chip.x, y: chip.y })
  }
  emit({ open: chip.target, openKept: true, chips })
}

export function closeAgentHubMirror(): void {
  if (state.open) {
    emit({ ...state, open: null, openKept: false })
  }
}

export function closeAgentHubMirrorChip(key: string): void {
  emit({ ...state, chips: state.chips.filter((chip) => keyOf(chip.target) !== key) })
}

export function moveAgentHubMirrorChip(key: string, position: { x: number; y: number }): void {
  emit({
    ...state,
    chips: state.chips.map((chip) => (keyOf(chip.target) === key ? { ...chip, ...position } : chip))
  })
}

/** Test seam: start every case from an empty stage. */
export function resetAgentHubMirrorsForTest(): void {
  emit({ open: null, openKept: false, chips: [] })
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
