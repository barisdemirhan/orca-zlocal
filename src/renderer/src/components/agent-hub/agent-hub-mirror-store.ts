import { requestAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { prepareAgentHubMirrorBatch } from './agent-hub-mirror-batch-open'
import {
  createAgentHubMirrorWindowAtPreferredPlace as createAgentHubMirrorWindow,
  releaseAgentHubMirrorWindowPlace,
  rememberAgentHubMirrorSourcePlacesLeaving,
  resetAgentHubMirrorSourcePlacesForTest
} from './agent-hub-mirror-source-places'
import { highlightAgentHubMirror } from './agent-hub-mirror-signals'
export {
  useAgentHubMirrorHighlight,
  requestAgentHubMirrorsDock,
  useAgentHubMirrorsDockRequest
} from './agent-hub-mirror-signals'
import {
  parkAgentHubMirrorWindow as withChip,
  raiseAgentHubMirrorWindow
} from './agent-hub-mirror-window-stack'
import {
  reopenAgentHubMirrorState,
  type AgentHubReopenedMirror
} from './agent-hub-mirror-session-reopen'
export type { AgentHubReopenedMirror } from './agent-hub-mirror-session-reopen'
import { resolveAgentHubMirrorTarget, resolveAgentHubMirrorWindow } from './agent-hub-mirror-source'
import {
  DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP,
  normalizeAgentHubMirrorWindowCap
} from '../../../../shared/agent-hub-settings'
import { useSyncExternalStore } from 'react'
import {
  endAgentHubMirrorFocus,
  holdAgentHubMirrorFocusOn,
  readAgentHubMirrorFocus,
  setAgentHubMirrorFocus
} from './agent-hub-mirror-focus'
import { resetAgentHubMirrorPlacesForTest } from './agent-hub-mirror-places'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  agentHubMirrorWindows,
  findAgentHubMirrorMembership,
  selectAgentHubMirrorTarget,
  replaceAgentHubMirrorWindow,
  removeAgentHubMirrorChipsOfTab,
  hasAgentHubMirrorEntryRoom,
  type AgentHubMirrorState,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
export type { AgentHubMirrorChip, AgentHubMirrorState } from './agent-hub-mirror-membership'

let windowCap = DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP
let state: AgentHubMirrorState = { windows: [], chips: [] }
const listeners = new Set<() => void>()
let quiet = false

function emit(next: AgentHubMirrorState): void {
  rememberAgentHubMirrorSourcePlacesLeaving(state, next)
  const remaining = new Set(agentHubMirrorWindows(next).map((window) => window.id))
  for (const window of agentHubMirrorWindows(state)) {
    if (!remaining.has(window.id)) {
      releaseAgentHubMirrorWindowPlace(window)
    }
  }
  state = next
  holdAgentHubMirrorFocusOn(next.windows.at(-1)?.id ?? null)
  listeners.forEach((listener) => listener())
}
function showWindow(
  current: AgentHubMirrorState,
  window: AgentHubMirrorWindowState
): AgentHubMirrorState {
  return raiseAgentHubMirrorWindow(current, window, windowCap)
}
/** Pop-out always selects the requested source tab, including a different split leaf. */
export function openAgentHubMirror(
  request: AgentHubPaneTarget
): 'opened' | 'missing-source' | 'entry-cap' {
  const target = resolveAgentHubMirrorTarget(request)
  if (!target) {
    return 'missing-source'
  }
  const owner = findAgentHubMirrorMembership(state, target)
  if (!owner && !hasAgentHubMirrorEntryRoom(state)) {
    return 'entry-cap'
  }
  const window = owner
    ? selectAgentHubMirrorTarget(owner.window, owner.tab.id, target)
    : createAgentHubMirrorWindow(target)
  quiet = false
  emit(showWindow(state, window))
  if (owner?.presence === 'window') {
    highlightAgentHubMirror(window.id)
  }
  requestAgentHubMirrorSelection(window.id, window.activeTabId)
  return 'opened'
}

export function openAgentHubMirrors(targets: readonly AgentHubPaneTarget[]): void {
  const next = prepareAgentHubMirrorBatch(state, targets, windowCap)
  if (next) {
    quiet = false
    emit(next)
  }
}

/** Phase 2's singleton family UI replaces content without changing window or entry identity. */
export function retargetAgentHubMirror(windowId: string, request: AgentHubPaneTarget): void {
  const target = resolveAgentHubMirrorTarget(request)
  if (!target) {
    return
  }
  const window = state.windows.find((open) => open.id === windowId)
  if (!window) {
    return
  }
  const owner = findAgentHubMirrorMembership(state, target)
  if (owner) {
    openAgentHubMirror(target)
    return
  }
  const active = window.tabs.find((tab) => tab.id === window.activeTabId)
  if (!active) {
    return
  }
  quiet = false
  emit(
    replaceAgentHubMirrorWindow(
      state,
      windowId,
      selectAgentHubMirrorTarget(window, active.id, target)
    )
  )
}
export function focusAgentHubMirror(id: string): void {
  const window = state.windows.find((open) => open.id === id)
  if (window) {
    const wasQuiet = quiet
    quiet = false
    if (state.windows.at(-1) !== window) {
      emit(showWindow(state, window))
    } else if (wasQuiet) {
      emit(state)
    }
  }
}
export function toggleAgentHubMirrorFocus(id: string): void {
  if (readAgentHubMirrorFocus() === id) {
    endAgentHubMirrorFocus()
  } else if (state.windows.some((window) => window.id === id)) {
    focusAgentHubMirror(id)
    setAgentHubMirrorFocus(id)
  }
}
export function minimizeAgentHubMirror(id: string): void {
  const window = state.windows.find((open) => open.id === id)
  if (window) {
    emit({
      windows: state.windows.filter((open) => open.id !== id),
      chips: withChip(state.chips, window)
    })
  }
}
export function parkAgentHubMirror(request: AgentHubPaneTarget): void {
  const target = resolveAgentHubMirrorTarget(request)
  if (!target) {
    return
  }
  if (!findAgentHubMirrorMembership(state, target) && hasAgentHubMirrorEntryRoom(state)) {
    emit({ ...state, chips: withChip(state.chips, createAgentHubMirrorWindow(target)) })
  }
}
/** Removes that source entry only; a grouped chip survives with a repaired active entry. */
export function closeAgentHubMirrorChipsOfTab(tabId: string): void {
  const next = removeAgentHubMirrorChipsOfTab(state, tabId)
  if (next !== state) {
    emit(next)
  }
}
export function minimizeAllAgentHubMirrors(): void {
  if (state.windows.length) {
    emit({ windows: [], chips: state.windows.reduce(withChip, state.chips) })
  }
}
export function restoreAgentHubMirror(id: string): void {
  const chip = state.chips.find((item) => item.window.id === id)
  if (chip) {
    const window = resolveAgentHubMirrorWindow(chip.window, resolveAgentHubMirrorTarget)
    if (window) {
      quiet = false
      emit(showWindow(state, window))
      requestAgentHubMirrorSelection(window.id, window.activeTabId)
    } else {
      emit(replaceAgentHubMirrorWindow(state, id, null))
    }
  }
}
export function restoreAgentHubMirrors(ids: readonly string[]): void {
  let next = state
  for (const id of ids.slice(0, windowCap).toReversed()) {
    const chip = next.chips.find((item) => item.window.id === id)
    if (chip) {
      const window = resolveAgentHubMirrorWindow(chip.window, resolveAgentHubMirrorTarget)
      next = window ? showWindow(next, window) : replaceAgentHubMirrorWindow(next, id, null)
    }
  }
  if (next !== state) {
    quiet = false
    emit(next)
  }
}
export function reopenAgentHubMirrors(saved: readonly AgentHubReopenedMirror[]): void {
  const next = reopenAgentHubMirrorState(state, saved, windowCap, withChip)
  if (next) {
    quiet = state.windows.length === 0
    emit(next)
  }
}
export function isAgentHubMirrorStageQuiet(): boolean {
  return quiet
}
export function useAgentHubMirrorStageQuiet(): boolean {
  return useSyncExternalStore(subscribeAgentHubMirrors, isAgentHubMirrorStageQuiet)
}
export function closeAgentHubMirror(id: string): void {
  emit({ ...state, windows: state.windows.filter((window) => window.id !== id) })
}
export function closeAgentHubMirrorChip(id: string): void {
  emit({ ...state, chips: state.chips.filter((chip) => chip.window.id !== id) })
}
export function agentHubMirrorWindowCap(): number {
  return windowCap
}
export function setAgentHubMirrorWindowCap(cap: number): void {
  windowCap = normalizeAgentHubMirrorWindowCap(cap)
  if (state.windows.length <= windowCap) {
    return
  }
  let chips = state.chips
  for (const window of state.windows.slice(0, -windowCap)) {
    chips = withChip(chips, window)
  }
  emit({ windows: state.windows.slice(-windowCap), chips })
}
export function resetAgentHubMirrorsForTest(): void {
  windowCap = DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP
  resetAgentHubMirrorSourcePlacesForTest()
  resetAgentHubMirrorPlacesForTest()
  quiet = false
  emit({ windows: [], chips: [] })
}
export function readAgentHubMirrors(): AgentHubMirrorState {
  return state
}
export function subscribeAgentHubMirrors(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function useAgentHubMirrors(): AgentHubMirrorState {
  return useSyncExternalStore(subscribeAgentHubMirrors, readAgentHubMirrors)
}
export type AgentHubMirrorPresence = 'window' | 'chip' | null
export function useAgentHubMirrorPresence(
  target: AgentHubPaneTarget | string
): AgentHubMirrorPresence {
  return useSyncExternalStore(
    subscribeAgentHubMirrors,
    () => findAgentHubMirrorMembership(state, target)?.presence ?? null
  )
}
/** Only complete immutable operations are published to subscribers and session capture. */
export function commitAgentHubMirrorState(next: AgentHubMirrorState, raiseId?: string): void {
  quiet = false
  let chips = next.chips
  const raised = next.windows.find((window) => window.id === raiseId)
  const windows = raised
    ? [...next.windows.filter((window) => window !== raised), raised]
    : [...next.windows]
  while (windows.length > windowCap) {
    const evicted = windows.shift()
    if (evicted) {
      chips = withChip(chips, evicted)
    }
  }
  emit({ windows, chips })
}
