import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/class-names'
import type { AgentSessionPluginUiPress } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { readString, type PluginProps } from './plugin-prop-values'
import { PLUGIN_FAINT_COLOR, PLUGIN_LINK_COLOR } from './plugin-theme-colors'

/** The terminal inverts a button under the pointer or focus; `--plugin-fg` is its resting color. */
const BUTTON_CLASS = cn(
  // As in the terminal a truncating neighbour gives way first; a button wraps only when it alone is too wide.
  'm-0 max-w-full shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-left',
  'font-[inherit] text-[length:inherit] leading-[inherit] whitespace-pre-wrap [overflow-wrap:break-word]',
  'text-[color:var(--plugin-fg,inherit)] outline-none',
  'enabled:hover:bg-[color:var(--plugin-hover-bg,var(--chat-foreground))] enabled:hover:text-chat-canvas',
  'enabled:focus-visible:bg-[color:var(--plugin-hover-bg,var(--chat-foreground))] enabled:focus-visible:text-chat-canvas',
  'disabled:cursor-default'
)

/** A one- or two-cell glyph (◨, ×) is too small to hit; half a cell either side stays clear of a one-cell gap. */
const GLYPH_HIT_CLASS =
  'relative before:absolute before:inset-y-0 before:-inset-x-[calc(var(--plugin-cell,1ch)/2)]'

export function PluginButton({
  props,
  press,
  target,
  onPress,
  label,
  children
}: {
  props: PluginProps
  press: { plugin: string; handle: number } | undefined
  target: Pick<AgentSessionPluginUiPress, 'component' | 'instanceId'>
  onPress: (press: AgentSessionPluginUiPress) => void
  label: string
  children: ReactNode
}): React.JSX.Element {
  const isPlain = props.plain === true
  const color =
    !isPlain && props.variant === 'primary'
      ? PLUGIN_LINK_COLOR
      : props.dimColor === true
        ? PLUGIN_FAINT_COLOR
        : undefined
  const style = { '--plugin-fg': color } as CSSProperties
  const key = readString(props.key)
  const hotkey = readString(props.hotkey)
  // The terminal leads a button with its key: `1: Aquarium`.
  const keyed = hotkey ? (
    <>
      <span style={{ color: PLUGIN_LINK_COLOR }}>{hotkey}</span>: {children}
    </>
  ) : (
    children
  )
  return (
    <button
      type="button"
      className={cn(BUTTON_CLASS, isPlain && !hotkey && [...label].length <= 2 && GLYPH_HIT_CLASS)}
      style={style}
      aria-label={readString(props.label) ?? (label || undefined)}
      disabled={!press}
      onClick={() =>
        press &&
        onPress({
          ...target,
          plugin: press.plugin,
          handle: press.handle,
          ...(key !== undefined ? { key } : {})
        })
      }
    >
      {isPlain ? keyed : <>[ {keyed} ]</>}
    </button>
  )
}
