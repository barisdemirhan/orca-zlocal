import type { AgentHubFloatingLayout } from '../../../../shared/agent-hub-settings'
import { arrangeWindowsInCanvasDots } from './agent-hub-canvas-dot-grid'

export type { AgentHubFloatingLayout }

export type AgentHubRect = { left: number; top: number; width: number; height: number }

const GAP = 16
// The smallest a mirror or the floating workspace can be.
const MIN_WIDTH = 420
const MIN_HEIGHT = 280
// One or two windows should not swell to fill a wide screen.
const MAX_WIDTH = 1100
const MAX_HEIGHT = 760
// Terminals read best a little wider than tall.
const PREFERRED_ASPECT = 1.6

function shapeFor(
  count: number,
  area: AgentHubRect,
  layout: AgentHubFloatingLayout
): { cols: number; rows: number } {
  if (layout === 'columns') {
    return { cols: count, rows: 1 }
  }
  if (layout === 'rows') {
    return { cols: 1, rows: count }
  }
  let best = { cols: 1, rows: count }
  let bestMiss = Number.POSITIVE_INFINITY
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols)
    const cellWidth = (area.width - GAP * (cols + 1)) / cols
    const cellHeight = (area.height - GAP * (rows + 1)) / rows
    const miss = Math.abs(Math.log(cellWidth / cellHeight / PREFERRED_ASPECT))
    if (cellWidth > 0 && cellHeight > 0 && miss < bestMiss) {
      best = { cols, rows }
      bestMiss = miss
    }
  }
  return best
}

/**
 * Even, centred places for `count` floating windows inside `area` (the room between the
 * sidebars, under the title bar and above the status bar): a grid, one row, or one column, with
 * the same gap everywhere and a short last row centred under the others. On the canvas
 * (`onDots`) the places are whole dot cells instead.
 */
export function arrangeAgentHubFloatingWindows(
  count: number,
  area: AgentHubRect,
  layout: AgentHubFloatingLayout,
  onDots = false
): AgentHubRect[] {
  if (count <= 0) {
    return []
  }
  if (onDots) {
    return arrangeWindowsInCanvasDots(count, area, layout)
  }
  const { cols, rows } = shapeFor(count, area, layout)
  const fit = (room: number, cells: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, (room - GAP * (cells + 1)) / cells))
  const width = fit(area.width, cols, MIN_WIDTH, MAX_WIDTH)
  const height = fit(area.height, rows, MIN_HEIGHT, MAX_HEIGHT)
  const blockWidth = cols * width + (cols - 1) * GAP
  const blockHeight = rows * height + (rows - 1) * GAP
  const left = area.left + (area.width - blockWidth) / 2
  const top = area.top + Math.max(GAP, (area.height - blockHeight) / 2)
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / cols)
    const inRow = row === rows - 1 ? count - row * cols : cols
    const shift = ((cols - inRow) * (width + GAP)) / 2
    return {
      left: Math.round(left + shift + (index % cols) * (width + GAP)),
      top: Math.round(top + row * (height + GAP)),
      width: Math.round(width),
      height: Math.round(height)
    }
  })
}
