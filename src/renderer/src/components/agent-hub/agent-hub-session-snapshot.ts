import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import {
  isWorktreeHostIdentity,
  getWorktreeIdFromHostIdentity
} from '../../../../shared/worktree/host-qualified-identity'
import { AGENT_HUB_MIRROR_TAB_CAP, AGENT_HUB_MIRROR_ENTRY_CAP } from './agent-hub-mirror-membership'

export const AGENT_HUB_SESSION_STORAGE_KEY = 'orca-agent-hub-session-v2'
export const AGENT_HUB_SAVED_WINDOW_CAP = 32
export type AgentHubSavedMirrorTab = {
  id: string
  worktreeId: string
  tabId: string
  paneKey: string | null
  hostIdentity: string | null
  title: string
  agentType: string | null
  origin: 'manual' | 'auto'
  isPinned?: boolean
}
export type AgentHubSavedMirror = {
  id: string
  tabs: AgentHubSavedMirrorTab[]
  activeTabId: string
  minimized: boolean
  minimizedAt: number
  geometry: AgentHubMirrorGeometry | null
  keptPlace: boolean
}
export type AgentHubSessionSnapshot = {
  version: 2
  windows: AgentHubSavedMirror[]
  canvasOpen: boolean
  canvasParked: string[]
  hiddenFamilyRoots: string[]
}
export function isAgentHubSavedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function agentHubSavedStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.slice(0, 256).filter((item): item is string => typeof item === 'string' && item !== '')
    : []
}
export function agentHubSavedFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
export function parseAgentHubSavedGeometry(value: unknown): AgentHubMirrorGeometry | null {
  if (!isAgentHubSavedRecord(value)) {
    return null
  }
  const x = agentHubSavedFinite(value.x),
    y = agentHubSavedFinite(value.y)
  const width = agentHubSavedFinite(value.width),
    height = agentHubSavedFinite(value.height)
  return x === null || y === null || width === null || height === null || width <= 0 || height <= 0
    ? null
    : { x, y, width, height }
}
function parseTab(value: unknown): AgentHubSavedMirrorTab | null {
  if (!isAgentHubSavedRecord(value)) {
    return null
  }
  const { id, worktreeId, tabId, hostIdentity } = value
  if (
    typeof id !== 'string' ||
    !id ||
    typeof worktreeId !== 'string' ||
    !worktreeId ||
    typeof tabId !== 'string' ||
    !tabId
  ) {
    return null
  }
  if (
    typeof hostIdentity !== 'string' ||
    !isWorktreeHostIdentity(hostIdentity) ||
    getWorktreeIdFromHostIdentity(hostIdentity) !== worktreeId
  ) {
    return null
  }
  return {
    id,
    worktreeId,
    tabId,
    hostIdentity,
    paneKey: typeof value.paneKey === 'string' && value.paneKey ? value.paneKey : null,
    title: typeof value.title === 'string' ? value.title : '',
    agentType: typeof value.agentType === 'string' && value.agentType ? value.agentType : null,
    origin: value.origin === 'auto' ? 'auto' : 'manual',
    ...(value.isPinned === true ? { isPinned: true } : {})
  }
}
/** Bounded salvage, in stored order: first owner wins and an invalid active reference is repaired. */
export function parseAgentHubSessionSnapshot(value: unknown): AgentHubSessionSnapshot | null {
  if (!isAgentHubSavedRecord(value)) {
    return null
  }
  if (value.version !== 2 || !Array.isArray(value.windows)) {
    return null
  }
  const windows: AgentHubSavedMirror[] = []
  const windowIds = new Set<string>(),
    entryIds = new Set<string>(),
    sources = new Set<string>()
  let total = 0
  for (const raw of value.windows.slice(0, AGENT_HUB_SAVED_WINDOW_CAP)) {
    if (
      !isAgentHubSavedRecord(raw) ||
      typeof raw.id !== 'string' ||
      !raw.id ||
      windowIds.has(raw.id) ||
      !Array.isArray(raw.tabs)
    ) {
      continue
    }
    const tabs: AgentHubSavedMirrorTab[] = []
    for (const candidate of raw.tabs.slice(0, AGENT_HUB_MIRROR_TAB_CAP)) {
      if (total >= AGENT_HUB_MIRROR_ENTRY_CAP) {
        break
      }
      const tab = parseTab(candidate)
      if (!tab) {
        continue
      }
      const source = JSON.stringify([tab.hostIdentity, tab.tabId])
      if (entryIds.has(tab.id) || sources.has(source)) {
        continue
      }
      entryIds.add(tab.id)
      sources.add(source)
      tabs.push(tab)
      total++
    }
    const first = tabs[0]
    if (!first) {
      continue
    }
    windowIds.add(raw.id)
    windows.push({
      id: raw.id,
      tabs,
      activeTabId:
        tabs.some((tab) => tab.id === raw.activeTabId) && typeof raw.activeTabId === 'string'
          ? raw.activeTabId
          : first.id,
      minimized: raw.minimized === true,
      minimizedAt: agentHubSavedFinite(raw.minimizedAt) ?? 0,
      geometry: parseAgentHubSavedGeometry(raw.geometry),
      keptPlace: raw.keptPlace === true
    })
  }
  const parked = new Set(windows.filter((window) => window.minimized).map((window) => window.id))
  return {
    version: 2,
    windows,
    canvasOpen: value.canvasOpen === true,
    canvasParked: [...new Set(agentHubSavedStrings(value.canvasParked))].filter((id) =>
      parked.has(id)
    ),
    hiddenFamilyRoots: agentHubSavedStrings(value.hiddenFamilyRoots)
  }
}
export function agentHubSessionSnapshot(
  session: Omit<AgentHubSessionSnapshot, 'version'>
): AgentHubSessionSnapshot {
  return { version: 2, ...session }
}
function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}
export type AgentHubSessionRead = {
  status: 'absent' | 'valid' | 'damaged' | 'unsupported' | 'unavailable'
  snapshot: AgentHubSessionSnapshot | null
}
export function readAgentHubSessionRecord(): AgentHubSessionRead {
  try {
    const store = storage()
    if (!store) {
      return { status: 'unavailable', snapshot: null }
    }
    const stored = store.getItem(AGENT_HUB_SESSION_STORAGE_KEY)
    if (stored === null) {
      return { status: 'absent', snapshot: null }
    }
    let raw: unknown
    try {
      raw = JSON.parse(stored)
    } catch {
      return { status: 'damaged', snapshot: null }
    }
    if (isAgentHubSavedRecord(raw) && raw.version !== 2) {
      return { status: 'unsupported', snapshot: null }
    }
    const snapshot = parseAgentHubSessionSnapshot(raw)
    return { status: snapshot ? 'valid' : 'damaged', snapshot }
  } catch {
    return { status: 'unavailable', snapshot: null }
  }
}
export function readAgentHubSessionSnapshot(): AgentHubSessionSnapshot | null {
  return readAgentHubSessionRecord().snapshot
}
export function writeAgentHubSessionSnapshot(snapshot: AgentHubSessionSnapshot): boolean {
  try {
    const store = storage()
    if (!store) {
      return false
    }
    store.setItem(AGENT_HUB_SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}
export function clearAgentHubSessionSnapshot(): void {
  try {
    storage()?.removeItem(AGENT_HUB_SESSION_STORAGE_KEY)
  } catch {
    /* Storage is optional. */
  }
}
