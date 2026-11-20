import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/class-names'
import type {
  AgentSessionPluginJson,
  AgentSessionPluginNode,
  AgentSessionPluginUiPress
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

type Props = Record<string, AgentSessionPluginJson>
type PressTarget = Pick<AgentSessionPluginUiPress, 'component' | 'instanceId'>

const COLOR_CLASSES: Record<string, string> = {
  success: 'text-chat-diff-added',
  green: 'text-chat-diff-added',
  error: 'text-destructive',
  red: 'text-destructive',
  warning: 'text-chat-warning',
  yellow: 'text-chat-warning',
  dim: 'text-chat-foreground-faint',
  gray: 'text-chat-foreground-faint',
  grey: 'text-chat-foreground-faint'
}

const JUSTIFY: Record<string, CSSProperties['justifyContent']> = {
  'flex-start': 'flex-start',
  center: 'center',
  'flex-end': 'flex-end',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly'
}

const ALIGN: Record<string, CSSProperties['alignItems']> = {
  'flex-start': 'flex-start',
  center: 'center',
  'flex-end': 'flex-end',
  stretch: 'stretch'
}

// A terminal cell is about half a character wide.
function cells(value: AgentSessionPluginJson | undefined): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? `${value * 0.5}ch`
    : undefined
}

function boxStyle(props: Props): CSSProperties {
  const paddingX = cells(props.paddingX ?? props.padding)
  const paddingY = cells(props.paddingY ?? props.padding)
  const gap = cells(props.gap)
  return {
    flexDirection: props.flexDirection === 'column' ? 'column' : 'row',
    flexWrap: props.flexWrap === 'wrap' ? 'wrap' : undefined,
    columnGap: cells(props.columnGap) ?? gap,
    rowGap: cells(props.rowGap) ?? gap,
    paddingInline: paddingX,
    paddingBlock: paddingY,
    justifyContent:
      typeof props.justifyContent === 'string' ? JUSTIFY[props.justifyContent] : undefined,
    alignItems: typeof props.alignItems === 'string' ? ALIGN[props.alignItems] : undefined
  }
}

function textClasses(props: Props): string {
  const color = typeof props.color === 'string' ? COLOR_CLASSES[props.color] : undefined
  return cn(
    props.bold === true || props.weight === 'bold' ? 'font-semibold' : undefined,
    props.dimColor === true ? 'text-chat-foreground-faint' : color,
    typeof props.wrap === 'string' && props.wrap.startsWith('truncate')
      ? 'min-w-0 truncate whitespace-nowrap'
      : 'whitespace-pre-wrap'
  )
}

function PluginChildren({
  nodes,
  target,
  onPress
}: {
  nodes: AgentSessionPluginNode['children']
  target: PressTarget
  onPress: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element {
  return (
    <>
      {nodes?.map((child, index) =>
        typeof child === 'string' ? (
          child
        ) : (
          <NativeChatPluginTree key={index} node={child} target={target} onPress={onPress} />
        )
      )}
    </>
  )
}

/** Draws what a mod rendered; engine nodes and unknown types draw nothing, and strings are always text. */
export function NativeChatPluginTree({
  node,
  target,
  onPress
}: {
  node: AgentSessionPluginNode
  target: PressTarget
  onPress: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element | null {
  const props = node.props ?? {}
  if (node.type === 'Box') {
    return (
      <div className="flex min-w-0" style={boxStyle(props)}>
        <PluginChildren nodes={node.children} target={target} onPress={onPress} />
      </div>
    )
  }
  if (node.type === 'Text') {
    return (
      <span className={textClasses(props)}>
        <PluginChildren nodes={node.children} target={target} onPress={onPress} />
      </span>
    )
  }
  if (node.type === 'Button') {
    const press = node.press
    const label =
      typeof props.label === 'string'
        ? props.label
        : (node.children ?? []).filter((child) => typeof child === 'string').join('')
    return (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label={label || undefined}
        disabled={!press}
        className={cn(
          'font-normal',
          props.dimColor === true ? 'text-chat-foreground-faint' : undefined
        )}
        onClick={() =>
          press &&
          onPress({
            ...target,
            plugin: press.plugin,
            handle: press.handle,
            ...(typeof props.key === 'string' ? { key: props.key } : {})
          })
        }
      >
        {label || <PluginChildren nodes={node.children} target={target} onPress={onPress} />}
      </Button>
    )
  }
  return null
}
