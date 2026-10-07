import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'

export const AGENT_HUB_SESSION_STORAGE_KEY = 'orca-agent-hub-session-v1'
const VERSION = 1
// A hand-edited or damaged record must not flood the stage.
const MAX_MIRRORS = 32
const MAX_IDS = 256

/** One mirror as a restart keeps it: ids and hints only, resolved against the live store on return. */
export type AgentHubSavedMirror = {
  worktreeId: string
  tabId: string
  /** Null follows the tab's active pane. */
  paneKey: string | null
  title: string
  agentType: string | null
  /** Parked in the tray rather than open in a window. */
  minimized: boolean
  minimizedAt: number
  geometry: AgentHubMirrorGeometry | null
  /** The user chose the place, so it outlives closing the mirror. */
  keptPlace: boolean
}

export type AgentHubSessionSnapshot = {
  version: typeof VERSION
  /** Parked mirrors in the tray's order, then the open windows back to front. */
  mirrors: AgentHubSavedMirror[]
  canvasOpen: boolean
  /** The mirrors the canvas parked when it was last left, front first. */
  canvasParked: string[]
  hiddenFamilyRoots: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item !== '')
        .slice(0, MAX_IDS)
    : []
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseGeometry(value: unknown): AgentHubMirrorGeometry | null {
  if (!isRecord(value)) {
    return null
  }
  const x = finite(value.x)
  const y = finite(value.y)
  const width = finite(value.width)
  const height = finite(value.height)
  return x === null || y === null || width === null || height === null || width <= 0 || height <= 0
    ? null
    : { x, y, width, height }
}

function parseMirror(value: unknown): AgentHubSavedMirror | null {
  if (!isRecord(value)) {
    return null
  }
  const { worktreeId, tabId, paneKey, title, agentType } = value
  if (typeof worktreeId !== 'string' || !worktreeId || typeof tabId !== 'string' || !tabId) {
    return null
  }
  return {
    worktreeId,
    tabId,
    paneKey: typeof paneKey === 'string' && paneKey ? paneKey : null,
    title: typeof title === 'string' ? title : '',
    agentType: typeof agentType === 'string' && agentType ? agentType : null,
    minimized: value.minimized === true,
    minimizedAt: finite(value.minimizedAt) ?? 0,
    geometry: parseGeometry(value.geometry),
    keptPlace: value.keptPlace === true
  }
}

/** The snapshot in `value`, or null when it is not one this version wrote; bad entries are left out. */
export function parseAgentHubSessionSnapshot(value: unknown): AgentHubSessionSnapshot | null {
  if (!isRecord(value) || value.version !== VERSION || !Array.isArray(value.mirrors)) {
    return null
  }
  return {
    version: VERSION,
    mirrors: value.mirrors.flatMap((mirror) => parseMirror(mirror) ?? []).slice(0, MAX_MIRRORS),
    canvasOpen: value.canvasOpen === true,
    canvasParked: strings(value.canvasParked),
    hiddenFamilyRoots: strings(value.hiddenFamilyRoots)
  }
}

export function agentHubSessionSnapshot(
  session: Omit<AgentHubSessionSnapshot, 'version'>
): AgentHubSessionSnapshot {
  return { version: VERSION, ...session }
}

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

/**
 * Why localStorage, like the floating terminal panel's bounds: the mirrors belong to this window
 * of this profile. ui.json is shared with paired clients (ui.set), where a place on this screen
 * means nothing.
 */
export function readAgentHubSessionSnapshot(): AgentHubSessionSnapshot | null {
  try {
    const serialized = storage()?.getItem(AGENT_HUB_SESSION_STORAGE_KEY)
    return serialized ? parseAgentHubSessionSnapshot(JSON.parse(serialized)) : null
  } catch {
    return null
  }
}

export function writeAgentHubSessionSnapshot(snapshot: AgentHubSessionSnapshot): void {
  try {
    storage()?.setItem(AGENT_HUB_SESSION_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage can be unavailable or full; the hub then stays session-local.
  }
}

export function clearAgentHubSessionSnapshot(): void {
  try {
    storage()?.removeItem(AGENT_HUB_SESSION_STORAGE_KEY)
  } catch {
    // Nothing to clear without storage.
  }
}
