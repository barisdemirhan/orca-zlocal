import type { CSSProperties } from 'react'
import type { BorderSpec } from './plugin-border-style'
import { pluginCellsX, pluginCellsY } from './plugin-cell-metrics'
import {
  cellLength,
  firstDefined,
  readNumber,
  readOneOf,
  type PluginProps
} from './plugin-prop-values'
import { pluginColor } from './plugin-theme-colors'

type Side = 'Top' | 'Bottom' | 'Left' | 'Right'

const SIDE_AXIS: Record<Side, 'x' | 'y'> = { Top: 'y', Bottom: 'y', Left: 'x', Right: 'x' }
const SIDE_PAIR: Record<Side, 'X' | 'Y'> = { Top: 'Y', Bottom: 'Y', Left: 'X', Right: 'X' }

function sideLength(
  props: PluginProps,
  prefix: 'padding' | 'margin',
  side: Side,
  borderCell: boolean
): string | undefined {
  const axis = SIDE_AXIS[side]
  const base = cellLength(
    firstDefined(props[`${prefix}${side}`], props[`${prefix}${SIDE_PAIR[side]}`], props[prefix]),
    axis
  )
  if (!borderCell) {
    return base
  }
  const one = axis === 'x' ? pluginCellsX(1) : pluginCellsY(1)
  return base ? `calc(${base} + ${one})` : one
}

const DIRECTIONS = ['row', 'column', 'row-reverse', 'column-reverse'] as const
const WRAPS = ['nowrap', 'wrap', 'wrap-reverse'] as const
const ALIGN_ITEMS = ['flex-start', 'center', 'flex-end', 'stretch'] as const
const ALIGN_SELF = ['flex-start', 'center', 'flex-end', 'stretch', 'auto'] as const
const JUSTIFY = [
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'space-evenly'
] as const

/** Ink's Box on a CSS flex box; a drawn border side adds one cell of padding the frame fills. */
export function boxStyle(props: PluginProps, border: BorderSpec | null): CSSProperties {
  const gap = props.gap
  const overflowX = props.overflowX === 'scroll' ? 'auto' : undefined
  const style: CSSProperties = {
    display: props.display === 'none' ? 'none' : 'flex',
    boxSizing: 'border-box',
    position: props.position === 'absolute' ? 'absolute' : 'relative',
    flexDirection: readOneOf(props.flexDirection, DIRECTIONS) ?? 'row',
    flexWrap: readOneOf(props.flexWrap, WRAPS),
    flexGrow: readNumber(props.flexGrow),
    flexShrink: readNumber(props.flexShrink),
    alignItems: readOneOf(props.alignItems, ALIGN_ITEMS),
    alignSelf: readOneOf(props.alignSelf, ALIGN_SELF),
    justifyContent: readOneOf(props.justifyContent, JUSTIFY),
    columnGap: cellLength(firstDefined(props.columnGap, gap), 'x'),
    rowGap: cellLength(firstDefined(props.rowGap, gap), 'y'),
    width: cellLength(props.width, 'x'),
    height: cellLength(props.height, 'y'),
    minWidth: cellLength(props.minWidth, 'x') ?? 0,
    minHeight: cellLength(props.minHeight, 'y') ?? 0,
    maxWidth: cellLength(props.maxWidth, 'x'),
    maxHeight: cellLength(props.maxHeight, 'y'),
    top: cellLength(props.top, 'y'),
    bottom: cellLength(props.bottom, 'y'),
    left: cellLength(props.left, 'x'),
    right: cellLength(props.right, 'x'),
    paddingTop: sideLength(props, 'padding', 'Top', border?.sides.top === true),
    paddingBottom: sideLength(props, 'padding', 'Bottom', border?.sides.bottom === true),
    paddingLeft: sideLength(props, 'padding', 'Left', border?.sides.left === true),
    paddingRight: sideLength(props, 'padding', 'Right', border?.sides.right === true),
    marginTop: sideLength(props, 'margin', 'Top', false),
    marginBottom: sideLength(props, 'margin', 'Bottom', false),
    marginLeft: sideLength(props, 'margin', 'Left', false),
    marginRight: sideLength(props, 'margin', 'Right', false),
    overflow: props.overflow === 'hidden' ? 'hidden' : undefined,
    overflowX
  }
  if (!border) {
    style.backgroundColor = pluginColor(props.backgroundColor)
  }
  return style
}
