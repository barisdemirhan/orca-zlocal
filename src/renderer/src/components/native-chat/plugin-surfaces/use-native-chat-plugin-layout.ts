import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  AgentSessionPluginPane,
  AgentSessionPluginUiLayout
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import {
  PLUGIN_BAND_RESERVED_COLUMNS,
  PLUGIN_DOCK_MIN_COLUMNS,
  PLUGIN_PANE_DEFAULT_COLUMNS
} from './plugin-cell-metrics'

const REPORT_DEBOUNCE_MS = 150
// Inline frame: one border cell on each side, as the terminal draws it.
const INLINE_FRAME_COLUMNS = 2

type Measured = { frameColumns: number; columnColumns: number; rows: number }

export type NativeChatPluginLayout = AgentSessionPluginUiLayout & { dockColumns: number }

function cellsIn(element: HTMLElement | null, cell: HTMLElement | null): Measured | null {
  const cellBox = cell?.getBoundingClientRect()
  if (!element || !cellBox || cellBox.width <= 0 || cellBox.height <= 0) {
    return null
  }
  // The probe holds ten cells, so one cell is a tenth of its width.
  const cellWidth = cellBox.width / 10
  const frame = element.getBoundingClientRect()
  return {
    frameColumns: Math.floor(frame.width / cellWidth),
    columnColumns: 0,
    rows: Math.floor(frame.height / cellBox.height)
  }
}

/** The chat measured in mod cells, the seat it gives a pane, and the report that sizes the mods' drawings. */
export function useNativeChatPluginLayout({
  pane,
  isWorking,
  report
}: {
  pane: AgentSessionPluginPane | undefined
  isWorking: boolean
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
      const outer = cellsIn(frame, probeRef.current)
      const inner = cellsIn(column, probeRef.current)
      if (!outer || !inner) {
        return
      }
      const next = { ...outer, columnColumns: inner.frameColumns }
      setMeasured((current) =>
        current &&
        current.frameColumns === next.frameColumns &&
        current.columnColumns === next.columnColumns &&
        current.rows === next.rows
          ? current
          : next
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(column)
    return () => observer.disconnect()
  }, [])

  const layout = measured ? seatPluginUi(measured, pane, isWorking) : null
  const serialized = layout ? JSON.stringify(layout) : null
  const reportRef = useRef(report)
  reportRef.current = report

  useEffect(() => {
    if (!serialized || !reportRef.current) {
      return
    }
    const timer = setTimeout(() => {
      const { dockColumns: _dock, ...wire } = JSON.parse(serialized) as NativeChatPluginLayout
      reportRef.current?.(wire)
    }, REPORT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [serialized])

  return { frameRef, columnRef, probeRef, layout }
}

function seatPluginUi(
  { frameColumns, columnColumns, rows }: Measured,
  pane: AgentSessionPluginPane | undefined,
  isWorking: boolean
): NativeChatPluginLayout {
  const placement = frameColumns >= PLUGIN_DOCK_MIN_COLUMNS ? 'dock' : 'inline'
  const dockColumns = Math.max(
    20,
    Math.min(pane?.columns ?? PLUGIN_PANE_DEFAULT_COLUMNS, Math.floor(frameColumns * 0.45))
  )
  return {
    columns: Math.max(1, frameColumns),
    rows: Math.max(1, rows),
    placement,
    paneColumns:
      placement === 'dock' ? dockColumns : Math.max(1, columnColumns - INLINE_FRAME_COLUMNS),
    bandColumns: Math.max(1, columnColumns - PLUGIN_BAND_RESERVED_COLUMNS),
    isWorking,
    isDraft: false,
    dockColumns
  }
}
