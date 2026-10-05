import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { normalizeAgentHubFloatingLayout } from '../../../../shared/agent-hub-settings'
import { requestFloatingWorkspaceBounds } from '../floating-terminal/floating-workspace-place-request'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../sidebar/workspace-chrome-metrics'
import {
  arrangeAgentHubFloatingWindows,
  type AgentHubFloatingLayout,
  type AgentHubRect
} from './agent-hub-floating-arrange'
import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import { keepAgentHubMirrorPlace } from './agent-hub-mirror-store'

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

/** The room between the sidebars, under the title bar and above the status bar and the hub's dock. */
export function agentHubWorkArea(): AgentHubRect {
  const state = useAppStore.getState()
  const left = state.sidebarOpen ? state.sidebarWidth : 0
  // Mirrors on the canvas never share the window with the right sidebar: it is closed there,
  // and a mirror takes its place before the canvas has closed it.
  const onCanvas = state.settings?.agentHubCanvas !== false
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
  const windows: { key: string | null; rect: DOMRect }[] = []
  for (const element of document.querySelectorAll<HTMLElement>('[data-agent-hub-mirror-key]')) {
    const key = element.dataset.agentHubMirrorKey
    if (key) {
      windows.push({ key, rect: element.getBoundingClientRect() })
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
  const places = arrangeAgentHubFloatingWindows(windows.length, agentHubWorkArea(), layout)
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

/**
 * Lays the floating windows out in the user's default layout once the ones just opened have
 * mounted (the arrangement reads their boxes).
 */
export function arrangeAgentHubFloatingWindowsByDefault(): void {
  requestAnimationFrame(() =>
    arrangeAgentHubFloatingWindowsOnScreen(
      normalizeAgentHubFloatingLayout(useAppStore.getState().settings?.agentHubFloatingLayout)
    )
  )
}
