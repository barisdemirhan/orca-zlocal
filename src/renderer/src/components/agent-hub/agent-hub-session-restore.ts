import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import {
  isAgentHubCanvasOpen,
  openAgentHubCanvas,
  readAgentHubCanvasParked,
  rememberAgentHubCanvasParked
} from './agent-hub-canvas-store'
import { readAgentHubHiddenFamilyBars, setAgentHubHiddenFamilyBars } from './agent-hub-family-bar'
import { clampAgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import { isAgentHubMirrorPlaceKept, readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import {
  readAgentHubMirrors,
  reopenAgentHubMirrors,
  type AgentHubReopenedMirror
} from './agent-hub-mirror-store'
import {
  agentHubMirrorSourceKey,
  type AgentHubMirrorTab,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import { agentHubMirrorPaneExists, findAgentHubMirrorSource } from './agent-hub-mirror-source'
import {
  agentHubSessionSnapshot,
  type AgentHubSavedMirror,
  type AgentHubSessionSnapshot
} from './agent-hub-session-snapshot'
import type { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'

type AgentHubSessionState = Parameters<typeof agentHubTerminalTreeFromState>[0]
export type AgentHubRestoredSession = {
  mirrors: AgentHubReopenedMirror[]
  canvasParked: string[]
  /** The last session ended on the canvas: it opens again around the restored mirrors. */
  canvasOpen: boolean
  hiddenFamilyRoots: string[]
}
/** Resolve live source ownership after hydration; a missing precise leaf follows its surviving tab. */
export function resolveAgentHubSession(
  snapshot: AgentHubSessionSnapshot,
  state: AgentHubSessionState,
  options: { canvas: boolean; viewport: { width: number; height: number }; now: number }
): AgentHubRestoredSession {
  const parkWindows = options.canvas && !snapshot.canvasOpen
  const sources = new Set<string>()
  const mirrors = snapshot.windows.flatMap((saved): AgentHubReopenedMirror[] => {
    const tabs = saved.tabs.flatMap((entry): AgentHubMirrorTab[] => {
      const row = findAgentHubMirrorSource(state, entry)
      if (!row) {
        return []
      }
      const target = {
        worktree: row.worktree,
        repo: row.repo,
        tab: row.tab,
        paneKey:
          entry.paneKey && agentHubMirrorPaneExists(state, entry.tabId, entry.paneKey)
            ? entry.paneKey
            : null,
        title: entry.title || row.title,
        agentType: entry.agentType
      }
      const key = agentHubMirrorSourceKey(target)
      if (sources.has(key)) {
        return []
      }
      sources.add(key)
      return [
        {
          id: entry.id,
          target,
          origin: entry.origin,
          ...(entry.isPinned ? { isPinned: true } : {})
        }
      ]
    })
    const first = tabs[0]
    if (!first) {
      return []
    }
    return [
      {
        window: {
          id: saved.id,
          tabs,
          activeTabId: tabs.some((tab) => tab.id === saved.activeTabId)
            ? saved.activeTabId
            : first.id
        },
        minimized: saved.minimized || parkWindows,
        minimizedAt: saved.minimized ? saved.minimizedAt : options.now,
        place: saved.geometry
          ? {
              geometry: clampAgentHubMirrorGeometry(saved.geometry, options.viewport),
              kept: saved.keptPlace
            }
          : null
      }
    ]
  })
  const parked = new Set(
    mirrors.filter((mirror) => mirror.minimized).map((mirror) => mirror.window.id)
  )
  const tabIds = new Set(
    Object.values(state.tabsByWorktree).flatMap((tabs) => tabs.map((tab) => tab.id))
  )
  return {
    mirrors,
    canvasParked: options.canvas ? snapshot.canvasParked.filter((id) => parked.has(id)) : [],
    canvasOpen: options.canvas && snapshot.canvasOpen,
    hiddenFamilyRoots: snapshot.hiddenFamilyRoots.filter((root) =>
      tabIds.has(parsePaneKey(root)?.tabId ?? '')
    )
  }
}
export function applyAgentHubSession(restored: AgentHubRestoredSession): void {
  if (restored.hiddenFamilyRoots.length) {
    setAgentHubHiddenFamilyBars([...restored.hiddenFamilyRoots, ...readAgentHubHiddenFamilyBars()])
  }
  reopenAgentHubMirrors(restored.mirrors)
  const parked = new Set(readAgentHubMirrors().chips.map((chip) => chip.window.id))
  rememberAgentHubCanvasParked(restored.canvasParked.filter((id) => parked.has(id)))
  if (restored.canvasOpen) {
    openAgentHubCanvas(true)
  }
}
function savedMirror(
  window: AgentHubMirrorWindowState,
  minimized: boolean,
  minimizedAt: number
): AgentHubSavedMirror {
  return {
    id: window.id,
    activeTabId: window.activeTabId,
    tabs: window.tabs.map(({ id, target, origin, isPinned }) => ({
      id,
      worktreeId: target.worktree.id,
      tabId: target.tab.id,
      paneKey: target.paneKey,
      hostIdentity: getWorktreeHostIdentity(target.worktree),
      title: target.title,
      agentType: target.agentType,
      origin,
      ...(isPinned ? { isPinned: true } : {})
    })),
    minimized,
    minimizedAt,
    geometry: readAgentHubMirrorOrigin(window.id),
    keptPlace: isAgentHubMirrorPlaceKept(window.id)
  }
}
export function captureAgentHubSession(): AgentHubSessionSnapshot {
  const { windows, chips } = readAgentHubMirrors()
  return agentHubSessionSnapshot({
    windows: [
      ...chips.map((chip) => savedMirror(chip.window, true, chip.minimizedAt)),
      ...windows.map((window) => savedMirror(window, false, 0))
    ],
    canvasOpen: isAgentHubCanvasOpen(),
    canvasParked: [...readAgentHubCanvasParked()],
    hiddenFamilyRoots: [...readAgentHubHiddenFamilyBars()]
  })
}
