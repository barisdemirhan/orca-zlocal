import type { CSSProperties } from 'react'
import type { BorderGlyphs, BorderSide, BorderSpec } from './plugin-border-style'
import { pluginCellsX, pluginCellsY } from './plugin-cell-metrics'
import { pluginColor } from './plugin-theme-colors'

const MAX_EDGE_CELLS = 400
const repeated = new Map<string, string>()

function edgeText(glyph: string, vertical: boolean): string {
  const key = `${vertical ? 'v' : 'h'}${glyph}`
  let text = repeated.get(key)
  if (text === undefined) {
    text = Array.from({ length: MAX_EDGE_CELLS }, () => glyph).join(vertical ? '\n' : '')
    repeated.set(key, text)
  }
  return text
}

type Cell = {
  side: BorderSide
  glyph: keyof BorderGlyphs
  row: number
  column: number
  edge?: 'horizontal' | 'vertical'
}

const CELLS: Cell[] = [
  { side: 'top', glyph: 'topLeft', row: 1, column: 1 },
  { side: 'top', glyph: 'top', row: 1, column: 2, edge: 'horizontal' },
  { side: 'top', glyph: 'topRight', row: 1, column: 3 },
  { side: 'left', glyph: 'left', row: 2, column: 1, edge: 'vertical' },
  { side: 'right', glyph: 'right', row: 2, column: 3, edge: 'vertical' },
  { side: 'bottom', glyph: 'bottomLeft', row: 3, column: 1 },
  { side: 'bottom', glyph: 'bottom', row: 3, column: 2, edge: 'horizontal' },
  { side: 'bottom', glyph: 'bottomRight', row: 3, column: 3 }
]

const CORNER_SIDES: Partial<Record<keyof BorderGlyphs, BorderSide>> = {
  topLeft: 'left',
  topRight: 'right',
  bottomLeft: 'left',
  bottomRight: 'right'
}

/** Box-drawing glyphs and the fill behind a Box's content, in the cells its border padding left free. */
export function PluginBorderFrame({
  border,
  background
}: {
  border: BorderSpec
  background: string | undefined
}): React.JSX.Element {
  const { sides, glyphs, colors, dim } = border
  const style: CSSProperties = {
    gridTemplateColumns: `${sides.left ? pluginCellsX(1) : '0px'} minmax(0, 1fr) ${sides.right ? pluginCellsX(1) : '0px'}`,
    gridTemplateRows: `${sides.top ? pluginCellsY(1) : '0px'} minmax(0, 1fr) ${sides.bottom ? pluginCellsY(1) : '0px'}`
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid" style={style}>
      <div style={{ gridRow: 2, gridColumn: 2, backgroundColor: pluginColor(background) }} />
      {CELLS.map(({ side, glyph, row, column, edge }) => {
        const adjacent = CORNER_SIDES[glyph]
        if (!sides[side] || (adjacent && !sides[adjacent])) {
          return null
        }
        return (
          <div
            key={glyph}
            className="overflow-hidden"
            style={{
              gridRow: row,
              gridColumn: column,
              color: colors[side],
              opacity: dim[side] ? 0.55 : undefined,
              whiteSpace: edge === 'vertical' ? 'pre' : 'nowrap',
              textOverflow: 'clip'
            }}
          >
            {edge ? edgeText(glyphs[glyph], edge === 'vertical') : glyphs[glyph]}
          </div>
        )
      })}
    </div>
  )
}
