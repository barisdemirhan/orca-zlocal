import type { AppState } from '@/store/types'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { collectLeafIdsInOrder } from '../terminal-pane/terminal-layout-leaf-ids'
import {
  isAgentHubCanvasOpen,
  readAgentHubCanvasParked,
  rememberAgentHubCanvasParked
} from './agent-hub-canvas-store'
import { readAgentHubHiddenFamilyBars, setAgentHubHiddenFamilyBars } from './agent-hub-family-bar'
import {
  clampAgentHubMirrorGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { isAgentHubMirrorPlaceKept, readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import {
  readAgentHubMirrors,
  reopenAgentHubMirrors,
  type AgentHubReopenedMirror
} from './agent-hub-mirror-store'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  agentHubSessionSnapshot,
  type AgentHubSavedMirror,
  type AgentHubSessionSnapshot
} from './agent-hub-session-snapshot'
import {
  agentHubRowOfTab,
  readAgentHubTabAutoPopouts,
  setAgentHubTabAutoPopouts
} from './agent-hub-tab-auto-popout'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'

type AgentHubSessionState = Parameters<typeof agentHubTerminalTreeFromState>[0]

export type AgentHubRestoredSession = {
  mirrors: AgentHubReopenedMirror[]
  canvasParked: string[]
  autoPopoutTabIds: string[]
  hiddenFamilyRoots: string[]
}

const NO_PARENTS: ReadonlyMap<string, string> = new Map()

/** Whether the saved pane is still a pane of its tab; a closed split falls back to the tab. */
function paneStillThere(
  layout: AppState['terminalLayoutsByTabId'][string] | undefined,
  tabId: string,
  paneKey: string
): boolean {
  const parsed = parsePaneKey(paneKey)
  if (!layout || parsed?.tabId !== tabId) {
    return false
  }
  return (
    layout.activeLeafId === parsed.leafId ||
    collectLeafIdsInOrder(layout.root).includes(parsed.leafId) ||
    Object.hasOwn(layout.ptyIdsByLeafId ?? {}, parsed.leafId)
  )
}

/**
 * The last session's snapshot against the store as it is now. A mirror whose tab or workspace is
 * gone is left out, one whose pane is gone follows its tab, and every place is pulled into the
 * window as it is today. With the canvas on but left, the windows it had stay parked.
 */
export function resolveAgentHubSession(
  snapshot: AgentHubSessionSnapshot,
  state: AgentHubSessionState,
  options: { canvas: boolean; viewport: { width: number; height: number }; now: number }
): AgentHubRestoredSession {
  // Why the hub's own tree: it already resolves a tab to its workspace (worktree, folder or the
  // floating terminal) and project; an archived or deleted workspace is not in it.
  const tree = agentHubTerminalTreeFromState(state, [], true, NO_PARENTS)
  const parkWindows = options.canvas && !snapshot.canvasOpen
  const keys = new Set<string>()
  const mirrors = snapshot.mirrors.flatMap((saved): AgentHubReopenedMirror[] => {
    const row = agentHubRowOfTab(tree, saved.tabId)
    if (!row || row.worktree.id !== saved.worktreeId) {
      return []
    }
    const layout = state.terminalLayoutsByTabId[saved.tabId]
    const target: AgentHubPaneTarget = {
      worktree: row.worktree,
      repo: row.repo,
      tab: row.tab,
      paneKey:
        saved.paneKey && paneStillThere(layout, saved.tabId, saved.paneKey) ? saved.paneKey : null,
      title: saved.title || row.title,
      agentType: saved.agentType
    }
    const key = agentHubPaneTargetKey(target)
    if (keys.has(key)) {
      return []
    }
    keys.add(key)
    return [
      {
        target,
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
  const tabIds = new Set(
    Object.values(state.tabsByWorktree).flatMap((tabs) => tabs.map((tab) => tab.id))
  )
  return {
    mirrors,
    canvasParked: options.canvas ? snapshot.canvasParked.filter((key) => keys.has(key)) : [],
    autoPopoutTabIds: snapshot.autoPopoutTabIds.filter((tabId) => tabIds.has(tabId)),
    hiddenFamilyRoots: snapshot.hiddenFamilyRoots.filter((root) =>
      tabIds.has(parsePaneKey(root)?.tabId ?? '')
    )
  }
}

/** Puts a resolved session on the stage, under whatever the user set since launch. */
export function applyAgentHubSession(restored: AgentHubRestoredSession): void {
  if (restored.autoPopoutTabIds.length > 0) {
    setAgentHubTabAutoPopouts([...restored.autoPopoutTabIds, ...readAgentHubTabAutoPopouts()])
  }
  if (restored.hiddenFamilyRoots.length > 0) {
    setAgentHubHiddenFamilyBars([...restored.hiddenFamilyRoots, ...readAgentHubHiddenFamilyBars()])
  }
  rememberAgentHubCanvasParked(restored.canvasParked)
  reopenAgentHubMirrors(restored.mirrors)
}

function savedMirror(
  target: AgentHubPaneTarget,
  minimized: boolean,
  minimizedAt: number
): AgentHubSavedMirror {
  const key = agentHubPaneTargetKey(target)
  // A focused mirror's own place is kept apart from the box it shows in, so this is never that box.
  const geometry: AgentHubMirrorGeometry | null = readAgentHubMirrorOrigin(key)
  return {
    worktreeId: target.worktree.id,
    tabId: target.tab.id,
    paneKey: target.paneKey,
    title: target.title,
    agentType: target.agentType,
    minimized,
    minimizedAt,
    geometry,
    keptPlace: isAgentHubMirrorPlaceKept(key)
  }
}

/** The hub's stage as a restart should find it. */
export function captureAgentHubSession(): AgentHubSessionSnapshot {
  const { windows, chips } = readAgentHubMirrors()
  return agentHubSessionSnapshot({
    mirrors: [
      ...chips.map((chip) => savedMirror(chip.target, true, chip.minimizedAt)),
      ...windows.map((target) => savedMirror(target, false, 0))
    ],
    canvasOpen: isAgentHubCanvasOpen(),
    canvasParked: [...readAgentHubCanvasParked()],
    autoPopoutTabIds: [...readAgentHubTabAutoPopouts()],
    hiddenFamilyRoots: [...readAgentHubHiddenFamilyBars()]
  })
}
