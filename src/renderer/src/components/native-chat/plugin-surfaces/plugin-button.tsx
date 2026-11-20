import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/class-names'
import type { AgentSessionPluginUiPress } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { readString, type PluginProps } from './plugin-prop-values'
import { PLUGIN_FAINT_COLOR, PLUGIN_LINK_COLOR } from './plugin-theme-colors'

/** The terminal inverts a button under the pointer or focus; `--plugin-fg` is its resting color. */
const BUTTON_CLASS = cn(
  'm-0 min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-left',
  'font-[inherit] text-[length:inherit] leading-[inherit] whitespace-pre-wrap [overflow-wrap:anywhere]',
  'text-[color:var(--plugin-fg,inherit)] outline-none',
  'enabled:hover:bg-[color:var(--plugin-hover-bg,var(--chat-foreground))] enabled:hover:text-chat-canvas',
  'enabled:focus-visible:bg-[color:var(--plugin-hover-bg,var(--chat-foreground))] enabled:focus-visible:text-chat-canvas',
  'disabled:cursor-default'
)

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
  return (
    <button
      type="button"
      className={BUTTON_CLASS}
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
      {isPlain ? children : <>[ {children} ]</>}
    </button>
  )
}
