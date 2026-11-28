import type { AgentHubFloatingLayout, AgentHubRect } from './agent-hub-floating-arrange'

/** The canvas's dot pitch (px); dots sit at multiples of it in window coordinates. */
export const CANVAS_DOT_PITCH = 22

const P = CANVAS_DOT_PITCH
// Dots closer than this to the work area's edge are not usable.
const AREA_MARGIN = 12
const MIN_COLS = 20
const MIN_ROWS = 11
const MAX_COLS = 50
const MAX_ROWS = 35
export const MIN_WIDTH = MIN_COLS * P
export const MIN_HEIGHT = MIN_ROWS * P

type DotBounds = { col0: number; col1: number; row0: number; row1: number }

export const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value))

/** The usable dot columns and rows (inclusive ends) inside `area`. */
export function dotBounds(area: AgentHubRect, margin = AREA_MARGIN): DotBounds {
  return {
    col0: Math.ceil((area.left + margin) / P),
    col1: Math.floor((area.left + area.width - margin) / P),
    row0: Math.ceil((area.top + margin) / P),
    row1: Math.floor((area.top + area.height - margin) / P)
  }
}

/**
 * A window's box with every edge on a dot: the size rounded to whole dots (at least the minimum,
 * at most the area), then the corner. A resize keeps the top-left and limits the size instead.
 */
export function snapRectToCanvasDots(
  rect: AgentHubRect,
  area: AgentHubRect,
  options: { resize?: boolean; minWidth?: number; minHeight?: number } = {}
): AgentHubRect {
  const bounds = dotBounds(area)
  const minCols = Math.max(MIN_COLS, Math.ceil((options.minWidth ?? 0) / P))
  const minRows = Math.max(MIN_ROWS, Math.ceil((options.minHeight ?? 0) / P))
  const axis = (
    start: number,
    size: number,
    low: number,
    high: number,
    min: number
  ): [number, number] => {
    if (options.resize) {
      const cell = clamp(Math.round(start / P), low, Math.max(low, high - min))
      return [cell, clamp(Math.round(size / P), min, Math.max(min, high - cell))]
    }
    const cells = clamp(Math.round(size / P), min, Math.max(min, high - low))
    return [clamp(Math.round(start / P), low, Math.max(low, high - cells)), cells]
  }
  const [col, cols] = axis(rect.left, rect.width, bounds.col0, bounds.col1, minCols)
  const [row, rows] = axis(rect.top, rect.height, bounds.row0, bounds.row1, minRows)
  return { left: col * P, top: row * P, width: cols * P, height: rows * P }
}

/** The focus box on dots: centred by whole cells, `margin` clear of the area's edges. */
export function focusRectInCanvasDots(
  area: AgentHubRect,
  margin: number,
  maxWidth: number,
  maxHeight: number
): AgentHubRect {
  const bounds = dotBounds(area, margin)
  const axis = (low: number, high: number, min: number, max: number): [number, number] => {
    const cells = clamp(high - low, min, Math.max(min, Math.floor(max / P)))
    return [low + Math.max(0, Math.floor((high - low - cells) / 2)), cells]
  }
  const [col, cols] = axis(bounds.col0, bounds.col1, MIN_COLS, maxWidth)
  const [row, rows] = axis(bounds.row0, bounds.row1, MIN_ROWS, maxHeight)
  return { left: col * P, top: row * P, width: cols * P, height: rows * P }
}

function shapeInCells(
  count: number,
  cols: number,
  rows: number,
  layout: AgentHubFloatingLayout
): { cols: number; rows: number } {
  // Why bounded: more cells than fit at the minimum would be raised back up and spill out.
  const maxCols = Math.max(1, Math.floor((cols + 1) / (MIN_COLS + 1)))
  const maxRows = Math.max(1, Math.floor((rows + 1) / (MIN_ROWS + 1)))
  if (layout === 'columns') {
    const across = Math.min(count, maxCols)
    return { cols: across, rows: Math.ceil(count / across) }
  }
  if (layout === 'rows') {
    const down = Math.min(count, maxRows)
    const across = Math.min(Math.ceil(count / down), maxCols)
    return { cols: across, rows: Math.ceil(count / across) }
  }
  let best: { cols: number; rows: number } | null = null
  let bestMiss = Number.POSITIVE_INFINITY
  for (let across = 1; across <= Math.min(count, maxCols); across += 1) {
    const down = Math.ceil(count / across)
    if (down > maxRows) {
      continue
    }
    const width = (cols - (across - 1)) / across
    const height = (rows - (down - 1)) / down
    const miss = Math.abs(Math.log(width / height / 1.6))
    if (miss < bestMiss) {
      best = { cols: across, rows: down }
      bestMiss = miss
    }
  }
  const widest = Math.min(count, maxCols)
  return best ?? { cols: widest, rows: Math.ceil(count / widest) }
}

/**
 * Places for `count` windows in whole dot cells: one dot between windows, cells sized to the
 * usable dots and clamped, leftover cells split left/right (and top/bottom), a short last row
 * centred by whole cells. More windows than fit at the minimum size overlap only along the
 * stepping direction, so every title bar stays visible and nothing leaves the area.
 */
export function arrangeWindowsInCanvasDots(
  count: number,
  area: AgentHubRect,
  layout: AgentHubFloatingLayout
): AgentHubRect[] {
  if (count <= 0) {
    return []
  }
  const bounds = dotBounds(area)
  const across = bounds.col1 - bounds.col0
  const down = bounds.row1 - bounds.row0
  const { cols, rows } = shapeInCells(count, across, down, layout)
  const cellWidth = clamp(Math.floor((across - (cols - 1)) / cols), MIN_COLS, MAX_COLS)
  const cellHeight = clamp(Math.floor((down - (rows - 1)) / rows), MIN_ROWS, MAX_ROWS)
  const stepFor = (cell: number, room: number, cells: number): number =>
    cells > 1 ? Math.max(0, Math.min(cell + 1, Math.floor((room - cell) / (cells - 1)))) : 0
  const stepX = stepFor(cellWidth, across, cols)
  const stepY = stepFor(cellHeight, down, rows)
  const blockWidth = (cols - 1) * stepX + cellWidth
  const blockHeight = (rows - 1) * stepY + cellHeight
  const left = bounds.col0 + Math.max(0, Math.floor((across - blockWidth) / 2))
  const top = bounds.row0 + Math.max(0, Math.floor((down - blockHeight) / 2))
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / cols)
    const inRow = row === rows - 1 ? count - row * cols : cols
    const shift = Math.floor(((cols - inRow) * stepX) / 2)
    return {
      left: (left + shift + (index % cols) * stepX) * P,
      top: (top + row * stepY) * P,
      width: cellWidth * P,
      height: cellHeight * P
    }
  })
}
