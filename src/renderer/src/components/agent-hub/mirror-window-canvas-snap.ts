import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import { planMirrorDropOnCanvas, snapMirrorGeometryToCanvas } from './agent-hub-canvas-dot-snap'
import type { AgentHubMirrorSnapPreview } from './AgentHubMirrorSnapGhost'

export type DragInput = {
  captured: boolean
  mode: 'move' | 'resize'
  next: AgentHubMirrorGeometry
  altKey: boolean
}

export function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

/** On the canvas: where a drop lands and what the mirrors it overlaps become. */
export function dropPlan(
  key: string,
  drag: DragInput
): { target: AgentHubMirrorGeometry; neighbours: Map<string, AgentHubMirrorGeometry> } | null {
  const target = drag.altKey ? null : snapMirrorGeometryToCanvas(drag.next, drag.mode === 'resize')
  return target ? planMirrorDropOnCanvas(key, target) : null
}

export function samePreview(
  a: AgentHubMirrorSnapPreview | null,
  b: AgentHubMirrorSnapPreview | null
): boolean {
  if (!a || !b) {
    return a === b
  }
  const boxes = (p: AgentHubMirrorSnapPreview): string =>
    [p.target, ...p.neighbours].map((g) => `${g.x},${g.y},${g.width},${g.height}`).join('|')
  return boxes(a) === boxes(b)
}

// Why by value: the focus box is derived anew on every render.
export function sameMirrorBox(a: AgentHubMirrorGeometry, b: AgentHubMirrorGeometry): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
