import {
  isAgentHubSavedRecord,
  agentHubSavedFinite,
  agentHubSavedStrings,
  parseAgentHubSavedGeometry,
  AGENT_HUB_SAVED_WINDOW_CAP,
  type AgentHubSavedMirror,
  type AgentHubSessionSnapshot
} from './agent-hub-session-snapshot'
import { parsePaneKey } from '../../../../shared/stable-pane-id'

/** Namespaced deterministic IDs preserve v1 geometry and canvas references without inventing provenance. */
export function migrateAgentHubSessionV1(
  value: Record<string, unknown>
): AgentHubSessionSnapshot | null {
  if (!Array.isArray(value.mirrors)) {
    return null
  }
  const windows: AgentHubSavedMirror[] = []
  const sources = new Set<string>()
  const mappedKeys = new Map<string, string>()
  for (const raw of value.mirrors.slice(0, AGENT_HUB_SAVED_WINDOW_CAP)) {
    if (!isAgentHubSavedRecord(raw)) {
      continue
    }
    const { worktreeId, tabId } = raw
    if (typeof worktreeId !== 'string' || !worktreeId || typeof tabId !== 'string' || !tabId) {
      continue
    }
    const source = JSON.stringify([worktreeId, tabId])
    if (sources.has(source)) {
      continue
    }
    sources.add(source)
    const paneKey =
      typeof raw.paneKey === 'string' && parsePaneKey(raw.paneKey)?.tabId === tabId
        ? raw.paneKey
        : null
    const oldKey = paneKey ?? tabId
    const id = `v1-window:${encodeURIComponent(JSON.stringify([worktreeId, oldKey]))}`
    const entryId = `v1-entry:${encodeURIComponent(JSON.stringify([worktreeId, oldKey]))}`
    mappedKeys.set(oldKey, id)
    windows.push({
      id,
      tabs: [
        {
          id: entryId,
          worktreeId,
          tabId,
          paneKey,
          hostIdentity: null,
          title: typeof raw.title === 'string' ? raw.title : '',
          agentType: typeof raw.agentType === 'string' && raw.agentType ? raw.agentType : null,
          origin: 'manual'
        }
      ],
      activeTabId: entryId,
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
    canvasParked: agentHubSavedStrings(value.canvasParked).flatMap((key) => {
      const id = mappedKeys.get(key)
      return id && parked.has(id) ? [id] : []
    }),
    hiddenFamilyRoots: agentHubSavedStrings(value.hiddenFamilyRoots)
  }
}
