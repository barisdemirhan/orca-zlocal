import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  AgentSessionPluginPane,
  AgentSessionPluginUiLayout
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import {
  PLUGIN_BAND_RESERVED_COLUMNS,
  PLUGIN_DOCK_MAX_SHARE,
  PLUGIN_DOCK_MIN_COLUMNS,
  PLUGIN_INLINE_FRAME_COLUMNS,
  PLUGIN_PANE_DEFAULT_COLUMNS
} from './plugin-cell-metrics'

const REPORT_DEBOUNCE_MS = 150
const BORDER_PX = 2

type Measured = {
  cellWidth: number
  frameColumns: number
  columnColumns: number
  inlineColumns: number
  rows: number
}

export type NativeChatPluginLayout = AgentSessionPluginUiLayout & {
  dockColumns: number
  cellWidth: number
}

function measureCells(
  frame: HTMLElement,
  column: HTMLElement,
  probe: HTMLElement | null
): Measured | null {
  const cell = probe?.getBoundingClientRect()
  if (!cell || cell.width <= 0 || cell.height <= 0) {
    return null
  }
  // The probe holds ten cells, so one cell is a tenth of its width.
  const cellWidth = cell.width / 10
  const outer = frame.getBoundingClientRect()
  const inner = column.getBoundingClientRect().width
  return {
    cellWidth,
    frameColumns: Math.floor(outer.width / cellWidth),
    columnColumns: Math.floor(inner / cellWidth),
    inlineColumns: Math.floor((inner - BORDER_PX) / cellWidth) - PLUGIN_INLINE_FRAME_COLUMNS,
    rows: Math.floor(outer.height / cell.height)
  }
}

/** The chat measured in mod cells, the seat it gives a pane, and the report that sizes the mods' drawings. */
export function useNativeChatPluginLayout({
  pane,
  isWorking,
  isBandCollapsed,
  report
}: {
  pane: AgentSessionPluginPane | undefined
  isWorking: boolean
  isBandCollapsed: boolean
  report: ((layout: AgentSessionPluginUiLayout) => void) | undefined
}): {
  frameRef: React.RefObject<HTMLDivElement | null>
  columnRef: React.RefObject<HTMLDivElement | null>
  probeRef: React.RefObject<HTMLSpanElement | null>
  layout: NativeChatPluginLayout | null
} {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const columnRef = useRef<HTMLDivElement | null>(null)
  const probeRef = useRef<HTMLSpanElement | null>(null)
  const [measured, setMeasured] = useState<Measured | null>(null)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const column = columnRef.current
    if (!frame || !column) {
      return
    }
    const measure = (): void => {
      const next = measureCells(frame, column, probeRef.current)
      if (!next) {
        return
      }
      setMeasured((current) =>
        current &&
        current.cellWidth === next.cellWidth &&
        current.frameColumns === next.frameColumns &&
        current.columnColumns === next.columnColumns &&
        current.inlineColumns === next.inlineColumns &&
        current.rows === next.rows
          ? current
          : next
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(column)
    // The cell grows when the mono font finishes loading, with no size change to the frame.
    if (probeRef.current) {
      observer.observe(probeRef.current)
    }
    return () => observer.disconnect()
  }, [])

  const layout = measured ? seatPluginUi(measured, pane, isWorking, isBandCollapsed) : null
  const serialized = layout ? JSON.stringify(layout) : null
  const reportRef = useRef(report)
  reportRef.current = report

  useEffect(() => {
    if (!serialized || !reportRef.current) {
      return
    }
    const timer = setTimeout(() => {
      const {
        dockColumns: _dock,
        cellWidth: _cell,
        ...wire
      } = JSON.parse(serialized) as NativeChatPluginLayout
      reportRef.current?.(wire)
    }, REPORT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [serialized])

  return { frameRef, columnRef, probeRef, layout }
}

function seatPluginUi(
  { cellWidth, frameColumns, columnColumns, inlineColumns, rows }: Measured,
  pane: AgentSessionPluginPane | undefined,
  isWorking: boolean,
  isBandCollapsed: boolean
): NativeChatPluginLayout {
  const placement = frameColumns >= PLUGIN_DOCK_MIN_COLUMNS ? 'dock' : 'inline'
  // As the terminal seats it: the asked width plus the rule and a cell, capped at its share.
  const dockColumns = Math.max(
    20,
    Math.min(
      (pane?.columns ?? PLUGIN_PANE_DEFAULT_COLUMNS) + 2,
      Math.floor(frameColumns * PLUGIN_DOCK_MAX_SHARE)
    ) - 1
  )
  return {
    columns: Math.max(1, frameColumns),
    rows: Math.max(1, rows),
    placement,
    paneColumns: placement === 'dock' ? dockColumns : Math.max(1, inlineColumns),
    bandColumns: Math.max(1, columnColumns - PLUGIN_BAND_RESERVED_COLUMNS),
    hintColumns: Math.max(1, columnColumns),
    isWorking,
    isDraft: false,
    isBandCollapsed,
    dockColumns,
    cellWidth
  }
}
