import type { AgentSessionPluginJson } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { pluginColor } from './plugin-theme-colors'
import { firstDefined, type PluginProps } from './plugin-prop-values'

export type BorderSide = 'top' | 'bottom' | 'left' | 'right'

export type BorderGlyphs = {
  topLeft: string
  top: string
  topRight: string
  right: string
  bottomRight: string
  bottom: string
  bottomLeft: string
  left: string
}

export type BorderSpec = {
  glyphs: BorderGlyphs
  sides: Record<BorderSide, boolean>
  colors: Record<BorderSide, string | undefined>
  dim: Record<BorderSide, boolean>
}

const glyphSet = (
  corners: string,
  horizontal: string,
  vertical: string = horizontal
): BorderGlyphs => {
  const [topLeft, topRight, bottomRight, bottomLeft] = [...corners]
  return {
    topLeft,
    top: horizontal,
    topRight,
    right: vertical,
    bottomRight,
    bottom: horizontal,
    bottomLeft,
    left: vertical
  }
}

const BORDER_GLYPHS: Record<string, BorderGlyphs> = {
  single: glyphSet('┌┐┘└', '─', '│'),
  double: glyphSet('╔╗╝╚', '═', '║'),
  round: glyphSet('╭╮╯╰', '─', '│'),
  bold: glyphSet('┏┓┛┗', '━', '┃'),
  singleDouble: glyphSet('╓╖╜╙', '─', '║'),
  doubleSingle: glyphSet('╒╕╛╘', '═', '│'),
  classic: glyphSet('++++', '-', '|'),
  hidden: glyphSet('    ', ' '),
  arrow: {
    topLeft: '↘',
    top: '↓',
    topRight: '↙',
    right: '←',
    bottomRight: '↖',
    bottom: '↑',
    bottomLeft: '↗',
    left: '→'
  }
}

const SIDES: BorderSide[] = ['top', 'bottom', 'left', 'right']
const cap = (side: BorderSide): string => side[0].toUpperCase() + side.slice(1)

function readGlyphs(style: AgentSessionPluginJson | undefined): BorderGlyphs | undefined {
  if (typeof style === 'string') {
    return BORDER_GLYPHS[style] ?? BORDER_GLYPHS.single
  }
  if (style && typeof style === 'object' && !Array.isArray(style)) {
    const pick = (key: keyof BorderGlyphs): string => {
      const value = style[key]
      return typeof value === 'string' && value !== '' ? value : ' '
    }
    return {
      topLeft: pick('topLeft'),
      top: pick('top'),
      topRight: pick('topRight'),
      right: pick('right'),
      bottomRight: pick('bottomRight'),
      bottom: pick('bottom'),
      bottomLeft: pick('bottomLeft'),
      left: pick('left')
    }
  }
  return undefined
}

/** Ink's borderStyle and per-side overrides; a drawn side costs one terminal cell. */
export function readBorder(props: PluginProps): BorderSpec | null {
  const glyphs = readGlyphs(props.borderStyle)
  if (!glyphs) {
    return null
  }
  const sides = {} as BorderSpec['sides']
  const colors = {} as BorderSpec['colors']
  const dim = {} as BorderSpec['dim']
  for (const side of SIDES) {
    sides[side] = props[`border${cap(side)}`] !== false
    colors[side] = pluginColor(firstDefined(props[`border${cap(side)}Color`], props.borderColor))
    dim[side] = firstDefined(props[`border${cap(side)}DimColor`], props.borderDimColor) === true
  }
  return { glyphs, sides, colors, dim }
}
