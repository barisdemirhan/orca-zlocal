import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { normalizeAgentHubFloatingLayout } from '../../../../shared/agent-hub-settings'
import { requestFloatingWorkspaceBounds } from '../floating-terminal/floating-workspace-place-request'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../../app-shell/chrome/workspace-chrome-metrics'
import {
  arrangeAgentHubFloatingWindows,
  type AgentHubFloatingLayout,
  type AgentHubRect
} from './agent-hub-floating-arrange'
import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import { endAgentHubMirrorFocus, readAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import {
  keepAgentHubMirrorPlace,
  readAgentHubMirrorOrigin,
  setAgentHubMirrorPlaceFree
} from './agent-hub-mirror-places'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { openAgentHubMirror, readAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

// Rows of windows this close (px) read as one row when keeping their order.
const ROW_BAND = 120

let version = 0
let placements: ReadonlyMap<string, AgentHubMirrorGeometry> = new Map()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Bumps whenever floating windows are arranged; each mirror then reads its own new place. */
export function useAgentHubArrangeVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function readAgentHubMirrorPlacement(key: string): AgentHubMirrorGeometry | null {
  return placements.get(key) ?? null
}

export function requestAgentHubMirrorPlacement(
  key: string,
  geometry: AgentHubMirrorGeometry
): void {
  requestAgentHubMirrorPlacements(new Map([[key, geometry]]))
}

/** Hands just these mirrors a new place (kept like a chosen one); the others stay as they are. */
export function requestAgentHubMirrorPlacements(
  next: ReadonlyMap<string, AgentHubMirrorGeometry>
): void {
  next.forEach((_geometry, key) => keepAgentHubMirrorPlace(key))
  placements = new Map(next)
  version += 1
  listeners.forEach((listener) => listener())
}

/** The room between the sidebars, under the title bar and above the status bar and the hub's dock. */
export function agentHubWorkArea(): AgentHubRect {
  const state = useAppStore.getState()
  const left = state.sidebarOpen ? state.sidebarWidth : 0
  // Mirrors on the canvas never share the window with the right sidebar: it is closed there,
  // and a mirror takes its place before the canvas has closed it.
  const onCanvas = isAgentHubCanvasOpen()
  const right = state.rightSidebarOpen && !onCanvas ? state.rightSidebarWidth : 0
  const bottom = state.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0
  const area = {
    left,
    top: WORKSPACE_TOP_CHROME_HEIGHT,
    width: window.innerWidth - left - right,
    height: window.innerHeight - WORKSPACE_TOP_CHROME_HEIGHT - bottom
  }
  // Why: a window laid over the dock would cover the button that sends it back to the hub.
  const dock = document.querySelector<HTMLElement>('[data-agent-hub-dock]')
  const edge = dock?.dataset.edge
  if (!dock || !edge) {
    return area
  }
  const box = dock.getBoundingClientRect()
  switch (edge) {
    case 'top': {
      // The dock hangs from the title bar, or from the window's edge while the canvas covers it.
      const top = Math.max(area.top, box.bottom)
      return { ...area, top, height: area.height - (top - area.top) }
    }
    case 'left':
      return { ...area, left: area.left + box.width, width: area.width - box.width }
    case 'right':
      return { ...area, width: area.width - box.width }
    default:
      return { ...area, height: area.height - box.height }
  }
}

/**
 * Lays every open floating window (the mirrors, and Orca's floating workspace when it is open)
 * out evenly in the work area, keeping their reading order so each moves as little as it can.
 */
export function arrangeAgentHubFloatingWindowsOnScreen(layout: AgentHubFloatingLayout): void {
  // Arranging ends a focus first; that mirror counts where it belongs, not where it is shown.
  const focused = readAgentHubMirrorFocus()
  endAgentHubMirrorFocus()
  const windows: { key: string | null; rect: { left: number; top: number } }[] = []
  for (const element of document.querySelectorAll<HTMLElement>('[data-agent-hub-mirror-key]')) {
    const key = element.dataset.agentHubMirrorKey
    const own = key === focused ? readAgentHubMirrorOrigin(key) : null
    if (key) {
      windows.push({
        key,
        rect: own ? { left: own.x, top: own.y } : element.getBoundingClientRect()
      })
    }
  }
  const panel = document.querySelector('[data-floating-terminal-panel][aria-hidden="false"]')
  if (panel) {
    windows.push({ key: null, rect: panel.getBoundingClientRect() })
  }
  windows.sort(
    (a, b) =>
      Math.round(a.rect.top / ROW_BAND) - Math.round(b.rect.top / ROW_BAND) ||
      a.rect.left - b.rect.left
  )
  const places = arrangeAgentHubFloatingWindows(
    windows.length,
    agentHubWorkArea(),
    layout,
    isAgentHubCanvasOpen()
  )
  const next = new Map<string, AgentHubMirrorGeometry>()
  windows.forEach((floating, index) => {
    const place = places[index]
    if (!place) {
      return
    }
    if (floating.key === null) {
      requestFloatingWorkspaceBounds(place)
    } else {
      keepAgentHubMirrorPlace(floating.key)
      setAgentHubMirrorPlaceFree(floating.key, false)
      next.set(floating.key, {
        x: place.left,
        y: place.top,
        width: place.width,
        height: place.height
      })
    }
  })
  placements = next
  version += 1
  listeners.forEach((listener) => listener())
}

function arrangeInDefaultLayout(): void {
  arrangeAgentHubFloatingWindowsOnScreen(
    normalizeAgentHubFloatingLayout(useAppStore.getState().settings?.agentHubFloatingLayout)
  )
}

/**
 * Lays the floating windows out in the user's default layout once the ones just opened have
 * mounted (the arrangement reads their boxes).
 */
export function arrangeAgentHubFloatingWindowsByDefault(): void {
  requestAnimationFrame(arrangeInDefaultLayout)
}

/**
 * After one mirror is closed, minimized or brought back, the open ones take the default layout
 * again so Arrange need not be pressed each time; with no mirror left nothing moves.
 */
export function rearrangeAgentHubMirrorsByDefault(): void {
  requestAnimationFrame(() => {
    if (document.querySelector('[data-agent-hub-mirror-key]')) {
      arrangeInDefaultLayout()
    }
  })
}

/**
 * Opens (or raises) the pane's mirror; when that puts a window on screen that was not there, the
 * open ones take the default layout again, as after closing or bringing one back.
 */
export function openAgentHubMirrorInLayout(
  target: AgentHubPaneTarget,
  focusTerminal = true
): ReturnType<typeof openAgentHubMirror> {
  const owner = findAgentHubMirrorMembership(readAgentHubMirrors(), target)
  const shownBefore = owner?.kind === 'tab' ? owner.presence : null
  const result = openAgentHubMirror(target, focusTerminal)
  if (result === 'opened' && shownBefore !== 'window') {
    rearrangeAgentHubMirrorsByDefault()
  }
  return result
}
