import type { AgentSessionPluginJson } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

const FAINT = 'var(--chat-foreground-faint)'
const LINK = 'var(--chat-link)'
const ADDED = 'var(--chat-diff-added)'
const REMOVED = 'var(--chat-diff-removed)'
const WARNING = 'var(--chat-warning)'
const CANVAS = 'var(--chat-canvas)'

const dimmed = (color: string): string => `color-mix(in srgb, ${color} 45%, ${CANVAS})`

/** Claude Code's ThemeKey names mapped onto Orca's chat tokens. */
const THEME_KEYS: Record<string, string> = {
  text: 'var(--chat-foreground)',
  inverseText: CANVAS,
  inactive: FAINT,
  subtle: FAINT,
  suggestion: LINK,
  remember: LINK,
  permission: LINK,
  ide: LINK,
  planMode: LINK,
  merged: LINK,
  success: ADDED,
  autoAccept: ADDED,
  error: 'var(--destructive)',
  warning: WARNING,
  claude: WARNING,
  promptBorder: 'var(--chat-composer-border)',
  bashBorder: REMOVED,
  diffAdded: ADDED,
  diffAddedWord: ADDED,
  diffAddedDimmed: dimmed(ADDED),
  diffRemoved: REMOVED,
  diffRemovedWord: REMOVED,
  diffRemovedDimmed: dimmed(REMOVED)
}

const ANSI_NAMES: Record<string, string> = {
  black: 'black',
  red: 'var(--destructive)',
  green: ADDED,
  yellow: WARNING,
  blue: LINK,
  magenta: 'magenta',
  cyan: 'cyan',
  white: 'white',
  gray: FAINT,
  grey: FAINT,
  blackBright: FAINT,
  redBright: REMOVED,
  greenBright: ADDED,
  yellowBright: WARNING,
  blueBright: LINK,
  magentaBright: 'violet',
  cyanBright: 'aquamarine',
  whiteBright: 'var(--chat-foreground-strong)'
}

const ANSI_16_ORDER = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright'
]

function ansi256(index: number): string | undefined {
  if (index < 0 || index > 255) {
    return undefined
  }
  if (index < 16) {
    return ANSI_NAMES[ANSI_16_ORDER[index]]
  }
  if (index >= 232) {
    const level = 8 + (index - 232) * 10
    return `rgb(${level} ${level} ${level})`
  }
  const cube = index - 16
  const step = (n: number): number => (n === 0 ? 0 : 55 + n * 40)
  return `rgb(${step(Math.floor(cube / 36))} ${step(Math.floor(cube / 6) % 6)} ${step(cube % 6)})`
}

/** A mod's Color (ThemeKey or raw string) as a CSS color; undefined leaves the inherited color. */
export function pluginColor(value: AgentSessionPluginJson | undefined): string | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  const named = THEME_KEYS[value] ?? ANSI_NAMES[value]
  if (named) {
    return named
  }
  const indexed = /^ansi256\(\s*(\d{1,3})\s*\)$/.exec(value)
  if (indexed) {
    return ansi256(Number(indexed[1]))
  }
  if (/^#([0-9a-f]{3,8})$/i.test(value) || /^rgba?\([\d\s.,%/]+\)$/i.test(value)) {
    return value
  }
  return /^[a-z]+$/i.test(value) ? value : undefined
}

export const PLUGIN_FAINT_COLOR = FAINT
export const PLUGIN_LINK_COLOR = LINK
export const PLUGIN_ADDED_COLOR = ADDED
export const PLUGIN_REMOVED_COLOR = REMOVED
export const PLUGIN_CANVAS_COLOR = CANVAS
