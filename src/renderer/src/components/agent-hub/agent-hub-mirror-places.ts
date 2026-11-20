import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'

// Where each window sat (and how large), so it comes back there. Not rendered state.
const origins = new Map<string, AgentHubMirrorGeometry>()
// Windows the user moved, resized or arranged: their place outlives closing them.
const kept = new Set<string>()
// Windows dropped with Option/Alt on the canvas: they stay off the dots until placed again.
const free = new Set<string>()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function rememberAgentHubMirrorOrigin(key: string, origin: AgentHubMirrorGeometry): void {
  const known = origins.get(key)
  origins.set(key, origin)
  // Why compared: every window reports its place on each layout; only a move is news.
  if (
    known?.x !== origin.x ||
    known.y !== origin.y ||
    known.width !== origin.width ||
    known.height !== origin.height
  ) {
    emit()
  }
}

/** The user chose this window's place, so it reopens there even after it is closed. */
export function keepAgentHubMirrorPlace(key: string): void {
  if (!kept.has(key)) {
    kept.add(key)
    emit()
  }
}

export function setAgentHubMirrorPlaceFree(key: string, isFree: boolean): void {
  if (isFree) {
    free.add(key)
  } else {
    free.delete(key)
  }
}

export function isAgentHubMirrorPlaceFree(key: string): boolean {
  return free.has(key)
}

export function isAgentHubMirrorPlaceKept(key: string): boolean {
  return kept.has(key)
}

/** Where a window last stood: it returns there from the tray, or reopens there if the user chose it. */
export function readAgentHubMirrorOrigin(key: string): AgentHubMirrorGeometry | null {
  return origins.get(key) ?? null
}

/** The mirror is gone: a place nobody chose goes with it. */
export function forgetUnkeptAgentHubMirrorPlace(key: string): void {
  if (!kept.has(key)) {
    origins.delete(key)
    free.delete(key)
  }
}

/** Source preferences retain chosen geometry after a window's ownership ends. */
export function releaseAgentHubMirrorPlace(key: string): void {
  origins.delete(key)
  kept.delete(key)
  free.delete(key)
}

/** The window at `fromKey` now shows another pane: that pane's mirror stands where it stood. */
export function copyAgentHubMirrorPlace(fromKey: string, toKey: string): void {
  const origin = origins.get(fromKey)
  if (origin) {
    origins.set(toKey, origin)
    if (kept.has(fromKey)) {
      kept.add(toKey)
    }
    if (free.has(fromKey)) {
      free.add(toKey)
    }
  }
}

/** Hears a window move, resize or get a place the user chose. */
export function subscribeAgentHubMirrorPlaces(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test seam: no window has stood anywhere. */
export function resetAgentHubMirrorPlacesForTest(): void {
  origins.clear()
  kept.clear()
  free.clear()
}
