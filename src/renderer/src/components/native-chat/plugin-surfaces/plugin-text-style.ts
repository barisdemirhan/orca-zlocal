import type { CSSProperties } from 'react'
import { readNumber, readOneOf, type PluginProps } from './plugin-prop-values'
import { PLUGIN_CANVAS_COLOR, PLUGIN_FAINT_COLOR, pluginColor } from './plugin-theme-colors'

export type TextWrap = 'wrap' | 'start' | 'middle' | 'end' | 'clip'

const WRAP_MODES: Record<string, TextWrap> = {
  wrap: 'wrap',
  end: 'end',
  truncate: 'end',
  'truncate-end': 'end',
  middle: 'middle',
  'truncate-middle': 'middle',
  'truncate-start': 'start',
  clip: 'clip'
}

export function readTextWrap(props: PluginProps): TextWrap | undefined {
  return typeof props.wrap === 'string' ? WRAP_MODES[props.wrap] : undefined
}

function weightOf(props: PluginProps): CSSProperties['fontWeight'] {
  const weight = readOneOf(props.weight, ['regular', 'medium', 'semibold', 'bold'] as const)
  if (weight) {
    return weight === 'regular' ? 400 : weight === 'medium' ? 500 : 700
  }
  return props.bold === true ? 700 : undefined
}

/** Ink's Text styles; the terminal ignores size, mono and tabular, so they are not drawn. */
export function textStyle(props: PluginProps, inButton = false): CSSProperties {
  const explicit = pluginColor(props.color)
  const dim = props.dimColor === true
  let color = dim
    ? explicit
      ? `color-mix(in srgb, ${explicit} 60%, transparent)`
      : PLUGIN_FAINT_COLOR
    : explicit
  let background = pluginColor(props.backgroundColor)
  if (props.inverse === true) {
    background = explicit ?? 'var(--chat-foreground)'
    color = pluginColor(props.backgroundColor) ?? PLUGIN_CANVAS_COLOR
  }
  const lines = [
    props.underline === true && 'underline',
    props.strikethrough === true && 'line-through'
  ]
    .filter(Boolean)
    .join(' ')
  const wrap = readTextWrap(props)
  const maxLines = readNumber(props.maxLines)
  const style: CSSProperties = {
    color,
    backgroundColor: background,
    fontWeight: weightOf(props),
    fontStyle: props.italic === true ? 'italic' : undefined,
    textDecorationLine: lines || undefined,
    direction: props.dir === 'rtl' ? 'rtl' : undefined,
    minWidth: 0,
    overflowWrap: 'anywhere'
  }
  if (inButton) {
    return style
  }
  if (wrap && wrap !== 'wrap') {
    return { ...style, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre' }
  }
  if (maxLines && maxLines >= 1) {
    return {
      ...style,
      display: '-webkit-box',
      WebkitLineClamp: Math.floor(maxLines),
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap'
    }
  }
  return { ...style, whiteSpace: 'pre-wrap' }
}
