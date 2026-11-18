import type { FloatingTerminalPanelBounds } from '../floating-terminal/geometry/floating-terminal-panel-bounds'
import {
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH
} from '../floating-terminal/geometry/floating-terminal-panel-bounds'
import { snapRectToCanvasDots } from './agent-hub-canvas-dot-grid'
import { planCanvasDotDrop, settleCanvasDotWindows } from './agent-hub-canvas-dot-resolve'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'
import type { AgentHubRect } from './agent-hub-floating-arrange'
import {
  clampAgentHubMirrorGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { isAgentHubMirrorPlaceFree, readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { useAppStore } from '@/store'
import { normalizeAgentHubFloatingLayout } from '../../../../shared/agent-hub-settings'

const toRect = (g: AgentHubMirrorGeometry) => ({
  left: g.x,
  top: g.y,
  width: g.width,
  height: g.height
})
const toGeometry = (r: {
  left: number
  top: number
  width: number
  height: number
}): AgentHubMirrorGeometry => ({ x: r.left, y: r.top, width: r.width, height: r.height })

/** The box on the canvas's dots, or null while the canvas is closed (placement is free there). */
export function snapMirrorGeometryToCanvas(
  geometry: AgentHubMirrorGeometry,
  resize = false
): AgentHubMirrorGeometry | null {
  if (!isAgentHubCanvasOpen()) {
    return null
  }
  return toGeometry(snapRectToCanvasDots(toRect(geometry), agentHubWorkArea(), { resize }))
}

/** The floating workspace's bounds on the canvas's dots; unchanged while the canvas is closed. */
export function snapFloatingBoundsToCanvas(
  bounds: FloatingTerminalPanelBounds
): FloatingTerminalPanelBounds {
  if (!isAgentHubCanvasOpen()) {
    return bounds
  }
  return snapRectToCanvasDots(bounds, agentHubWorkArea(), {
    minWidth: MIN_PANEL_WIDTH,
    minHeight: MIN_PANEL_HEIGHT
  })
}

function floatingPanelBoxes(): DOMRect[] {
  const panel = document
    .querySelector('[data-floating-terminal-panel][aria-hidden="false"]')
    ?.getBoundingClientRect()
  return panel ? [panel] : []
}

function openMirrorWindows(except?: string): { key: string; rect: AgentHubRect; free: boolean }[] {
  return readAgentHubMirrors().windows.flatMap((open) => {
    const origin = open.id === except ? null : readAgentHubMirrorOrigin(open.id)
    return origin
      ? [{ key: open.id, rect: toRect(origin), free: isAgentHubMirrorPlaceFree(open.id) }]
      : []
  })
}

/**
 * Where a window dropped at `moved` lands and what the other open mirrors become (the floating
 * workspace stays put and counts as an obstacle).
 */
export function planMirrorDropOnCanvas(
  key: string,
  moved: AgentHubMirrorGeometry
): { target: AgentHubMirrorGeometry; neighbours: Map<string, AgentHubMirrorGeometry> } {
  const plan = planCanvasDotDrop(
    toRect(moved),
    openMirrorWindows(key),
    agentHubWorkArea(),
    floatingPanelBoxes()
  )
  return {
    target: toGeometry(plan.target),
    neighbours: new Map([...plan.neighbours].map(([id, rect]) => [id, toGeometry(rect)]))
  }
}

/**
 * The area or the open mirrors changed: one pass over all open mirrors keeps them inside it, on
 * the dots and clear of each other. Mirrors that just opened (`fresh`) make room, not the ones
 * already there. Returns the mirrors that move.
 */
export function settleCanvasMirrors(
  fresh: ReadonlySet<string> = new Set()
): Map<string, AgentHubMirrorGeometry> {
  if (!isAgentHubCanvasOpen()) {
    return new Map()
  }
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const windows = openMirrorWindows()
    .map((w) => {
      const own = toGeometry(w.rect)
      return { ...w, rect: toRect(clampAgentHubMirrorGeometry(own, viewport, own)), from: w.rect }
    })
    .toSorted(
      (a, b) =>
        Number(fresh.has(a.key)) - Number(fresh.has(b.key)) ||
        a.from.top - b.from.top ||
        a.from.left - b.from.left
    )
  const settled = settleCanvasDotWindows(
    windows,
    agentHubWorkArea(),
    floatingPanelBoxes(),
    normalizeAgentHubFloatingLayout(useAppStore.getState().settings?.agentHubFloatingLayout)
  )
  const moves = new Map<string, AgentHubMirrorGeometry>()
  for (const w of windows) {
    const to = settled.get(w.key)
    const same =
      !to ||
      (to.left === w.from.left &&
        to.top === w.from.top &&
        to.width === w.from.width &&
        to.height === w.from.height)
    if (to && !same) {
      moves.set(w.key, toGeometry(to))
    }
  }
  return moves
}
