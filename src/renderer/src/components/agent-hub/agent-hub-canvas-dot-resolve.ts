import type { AgentHubRect } from './agent-hub-floating-arrange'
import {
  CANVAS_DOT_PITCH,
  MIN_HEIGHT,
  MIN_WIDTH,
  clamp,
  dotBounds,
  snapRectToCanvasDots
} from './agent-hub-canvas-dot-grid'

const P = CANVAS_DOT_PITCH

const overlaps = (a: AgentHubRect, b: AgentHubRect): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

// True when at least one dot lies between the boxes.
const apart = (a: AgentHubRect, b: AgentHubRect): boolean =>
  a.left + a.width + P <= b.left ||
  b.left + b.width + P <= a.left ||
  a.top + a.height + P <= b.top ||
  b.top + b.height + P <= a.top

const sameRect = (a: AgentHubRect, b: AgentHubRect): boolean =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

// Every dot cell the box touches: the start floored, the end ceiled.
function cellBox(rect: AgentHubRect): AgentHubRect {
  const left = Math.floor(rect.left / P) * P
  const top = Math.floor(rect.top / P) * P
  return {
    left,
    top,
    width: Math.ceil((rect.left + rect.width) / P) * P - left,
    height: Math.ceil((rect.top + rect.height) / P) * P - top
  }
}

const largestFirst = (a: AgentHubRect, b: AgentHubRect): number =>
  b.width * b.height - a.width * a.height

export type CanvasDotWindow = {
  key: string
  rect: AgentHubRect
  /** Placed freely (Option/Alt): only clamped into the area, never pushed, an obstacle to others. */
  free?: boolean
}

/** The box cut back from each side that leaves one dot to all of `conflicting`, and still fits. */
function cutBoxes(box: AgentHubRect, conflicting: readonly AgentHubRect[]): AgentHubRect[] {
  const right = box.left + box.width
  const bottom = box.top + box.height
  const afterLeft = Math.max(...conflicting.map((o) => o.left + o.width)) + P
  const afterTop = Math.max(...conflicting.map((o) => o.top + o.height)) + P
  return [
    { ...box, width: Math.min(...conflicting.map((o) => o.left)) - P - box.left },
    { ...box, left: afterLeft, width: right - afterLeft },
    { ...box, height: Math.min(...conflicting.map((o) => o.top)) - P - box.top },
    { ...box, top: afterTop, height: bottom - afterTop }
  ].filter(
    (cut) =>
      cut.width >= MIN_WIDTH &&
      cut.height >= MIN_HEIGHT &&
      conflicting.every((other) => apart(cut, other))
  )
}

/** Dot-aligned boxes of `size` inside `area` that keep one dot from every blocker, nearest first. */
function nearestFreeBox(
  size: { width: number; height: number },
  from: { left: number; top: number },
  area: AgentHubRect,
  blockers: readonly AgentHubRect[],
  scan: 'nearest' | 'first' = 'nearest'
): AgentHubRect | null {
  const bounds = dotBounds(area)
  const cols = Math.round(size.width / P)
  const rows = Math.round(size.height / P)
  const fromCol = Math.round(from.left / P)
  const fromRow = Math.round(from.top / P)
  let best: AgentHubRect | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  // `first` reads row by row from the top left; `nearest` keeps the closest to `from`.
  for (let row = bounds.row0; row <= bounds.row1 - rows; row += 1) {
    for (let col = bounds.col0; col <= bounds.col1 - cols; col += 1) {
      const distance = scan === 'first' ? 0 : (col - fromCol) ** 2 + (row - fromRow) ** 2
      if (distance >= bestDistance) {
        continue
      }
      const box = { left: col * P, top: row * P, width: cols * P, height: rows * P }
      if (blockers.every((other) => apart(box, other))) {
        if (scan === 'first') {
          return box
        }
        best = box
        bestDistance = distance
      }
    }
  }
  return best
}

/**
 * `box` made to leave its `conflicting` boxes alone: cut back from the cheapest side, else moved
 * to the nearest free spot (at its size, then at the minimum), clear of all `blockers`.
 */
function giveWay(
  box: AgentHubRect,
  conflicting: readonly AgentHubRect[],
  blockers: readonly AgentHubRect[],
  area: AgentHubRect
): AgentHubRect | null {
  const cut = cutBoxes(box, conflicting).toSorted(largestFirst)[0]
  return (
    cut ??
    nearestFreeBox(box, box, area, blockers) ??
    nearestFreeBox({ width: MIN_WIDTH, height: MIN_HEIGHT }, box, area, blockers)
  )
}

/**
 * What a dropped window and the windows it overlaps become, with one dot between them. Each
 * overlapped window is cut back or moved first (the dropped one keeps its place). When one gets
 * no room, the dropped window gives way instead and the others stay. When neither works the
 * overlap is accepted. `fixed` boxes (the floating workspace) never move and only count as obstacles.
 */
export function planCanvasDotDrop(
  moved: AgentHubRect,
  neighbours: readonly CanvasDotWindow[],
  area: AgentHubRect,
  fixed: readonly AgentHubRect[] = []
): { target: AgentHubRect; neighbours: Map<string, AgentHubRect> } {
  const boxes = neighbours.map((n) => ({ ...n, rect: n.free ? cellBox(n.rect) : n.rect }))
  const frozen = fixed.map(cellBox)
  const hit = boxes.filter((n) => !n.free && overlaps(n.rect, moved))
  const clear = boxes.filter((n) => !hit.includes(n))
  const resolved = new Map<string, AgentHubRect>()
  let stuck = clear.some((n) => overlaps(n.rect, moved))
  for (const neighbour of hit) {
    const blockers = [
      moved,
      ...frozen,
      ...clear.map((other) => other.rect),
      ...hit.filter((other) => other !== neighbour).map((o) => resolved.get(o.key) ?? o.rect)
    ]
    const way = giveWay(neighbour.rect, [moved], blockers, area)
    if (way) {
      resolved.set(neighbour.key, way)
    } else {
      stuck = true
    }
  }
  if (!stuck) {
    return { target: moved, neighbours: resolved }
  }
  const obstacles = [...boxes.map((n) => n.rect), ...frozen]
  const way = giveWay(
    moved,
    obstacles.filter((o) => overlaps(moved, o)),
    obstacles,
    area
  )
  return way ? { target: way, neighbours: new Map() } : { target: moved, neighbours: resolved }
}

function clampIntoArea(rect: AgentHubRect, area: AgentHubRect): AgentHubRect {
  const width = Math.min(rect.width, area.width)
  const height = Math.min(rect.height, area.height)
  return {
    left: clamp(rect.left, area.left, area.left + area.width - width),
    top: clamp(rect.top, area.top, area.top + area.height - height),
    width,
    height
  }
}

/**
 * One pass over every open window after the area changed: each is snapped and clamped; those that
 * did not change stay, unless they overlap an earlier one that stayed. The rest give way against
 * the stayers and each other; if that fails the windows are packed in reading order, then all at
 * the minimum size. Free windows are only clamped. Returns every window's new box.
 */
export function settleCanvasDotWindows(
  windows: readonly CanvasDotWindow[],
  area: AgentHubRect,
  fixed: readonly AgentHubRect[] = []
): Map<string, AgentHubRect> {
  const snapped = windows.map((w) => ({
    ...w,
    to: w.free ? clampIntoArea(w.rect, area) : snapRectToCanvasDots(w.rect, area)
  }))
  const frozen = fixed.map(cellBox)
  const obstacleOf = (w: (typeof snapped)[number]): AgentHubRect => (w.free ? cellBox(w.to) : w.to)
  const stayers: AgentHubRect[] = []
  const pushed: typeof snapped = []
  for (const w of snapped) {
    const box = obstacleOf(w)
    if (w.free || (sameRect(w.to, w.rect) && !stayers.some((o) => overlaps(box, o)))) {
      stayers.push(box)
    } else {
      pushed.push(w)
    }
  }
  const final = new Map(snapped.map((w) => [w.key, w.to]))
  const placed = [...frozen, ...stayers]
  let failed = false
  for (const w of pushed) {
    const conflicting = placed.filter((o) => overlaps(w.to, o))
    const way = conflicting.length === 0 ? w.to : giveWay(w.to, conflicting, placed, area)
    if (!way) {
      failed = true
      break
    }
    final.set(w.key, way)
    placed.push(way)
  }
  if (failed) {
    const order = snapped
      .filter((w) => !w.free)
      .toSorted((a, b) => a.to.top - b.to.top || a.to.left - b.to.left)
    const base = [...frozen, ...snapped.filter((w) => w.free).map(obstacleOf)]
    const pack = (minimum: boolean): Map<string, AgentHubRect> | null => {
      const blockers = [...base]
      const out = new Map<string, AgentHubRect>()
      const least = { width: MIN_WIDTH, height: MIN_HEIGHT }
      for (const w of order) {
        const box =
          (minimum ? null : nearestFreeBox(w.to, w.to, area, blockers, 'first')) ??
          nearestFreeBox(least, w.to, area, blockers, 'first')
        if (!box) {
          return null
        }
        out.set(w.key, box)
        blockers.push(box)
      }
      return out
    }
    const packed = pack(false) ?? pack(true)
    packed?.forEach((box, key) => final.set(key, box))
  }
  return final
}
