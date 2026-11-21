import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/class-names'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginUiEdit,
  AgentSessionPluginUiPress
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { withBlockGlyphs } from './plugin-block-glyphs'
import { PluginBorderFrame } from './plugin-border-frame'
import { readBorder } from './plugin-border-style'
import { boxStyle } from './plugin-box-style'
import { PluginButton } from './plugin-button'
import { PLUGIN_CELL_FONT_CLASS, PLUGIN_CELL_ROOT_STYLE, pluginCellsX } from './plugin-cell-metrics'
import { PluginClientRegion } from './client/PluginClientRegion'
import { PluginCodeBlock } from './plugin-code-block'
import { PluginInput } from './plugin-input'
import { PluginLink, PluginMarkdown, PluginSvg } from './plugin-media-elements'
import { readString } from './plugin-prop-values'
import { readTextWrap, textStyle } from './plugin-text-style'

type PressTarget = Pick<AgentSessionPluginUiPress, 'component' | 'instanceId'>
type TreeContext = {
  target: PressTarget
  onPress: (press: AgentSessionPluginUiPress) => void
  onEdit?: (edit: AgentSessionPluginUiEdit) => void
}

function stringChildren(node: AgentSessionPluginNode): string | undefined {
  const children = node.children ?? []
  return children.every((child) => typeof child === 'string') ? children.join('') : undefined
}

function PluginChildren({
  node,
  context
}: {
  node: AgentSessionPluginNode
  context: TreeContext
}): React.JSX.Element {
  return (
    <>
      {node.children?.map((child, index) =>
        typeof child === 'string' ? (
          withBlockGlyphs(child)
        ) : (
          <PluginElement key={index} node={child} context={context} />
        )
      )}
    </>
  )
}

function PluginElement({
  node,
  context
}: {
  node: AgentSessionPluginNode
  context: TreeContext
}): React.JSX.Element | null {
  const props = node.props ?? {}
  const children: ReactNode = <PluginChildren node={node} context={context} />
  switch (node.type) {
    case 'engine':
      return null
    case 'Box': {
      const border = readBorder(props)
      return (
        <div className={cn(border && 'isolate')} style={boxStyle(props, border)}>
          {border ? (
            <PluginBorderFrame border={border} background={readString(props.backgroundColor)} />
          ) : null}
          {children}
        </div>
      )
    }
    case 'Text': {
      const text = readTextWrap(props) === 'start' ? stringChildren(node) : undefined
      const style: CSSProperties = textStyle(props)
      return text !== undefined ? (
        <span style={{ ...style, direction: 'rtl', textAlign: 'left' }}>
          <bdi dir="ltr">{withBlockGlyphs(text)}</bdi>
        </span>
      ) : (
        <span style={style}>{children}</span>
      )
    }
    case 'Button': {
      const label = readString(props.label) ?? stringChildren(node) ?? ''
      return (
        <PluginButton
          props={props}
          press={node.press}
          target={context.target}
          onPress={context.onPress}
          label={label}
        >
          {readString(props.label) ?? children}
        </PluginButton>
      )
    }
    case 'Input':
      return (
        <PluginInput
          props={props}
          press={node.press}
          target={context.target}
          onEdit={context.onEdit}
        />
      )
    case 'Client':
      return (
        <PluginClientRegion
          node={node}
          target={context.target}
          renderTree={(tree, onPress) => (
            <PluginElement node={tree} context={{ target: context.target, onPress }} />
          )}
        />
      )
    case 'Link':
      return (
        <PluginLink props={props}>
          {node.children?.length ? children : (readString(props.label) ?? readString(props.href))}
        </PluginLink>
      )
    case 'Code':
      return <PluginCodeBlock props={props} />
    case 'Markdown':
      return <PluginMarkdown props={props} />
    case 'Svg':
      return <PluginSvg props={props} />
    default:
      return node.children?.length ? <>{children}</> : null
  }
}

/** Draws what a mod rendered the way the terminal lays it out: Ink flex semantics on a monospace cell grid. */
export function NativeChatPluginTree({
  node,
  target,
  onPress,
  onEdit,
  columns
}: {
  node: AgentSessionPluginNode
  target: PressTarget
  onPress: (press: AgentSessionPluginUiPress) => void
  onEdit?: (edit: AgentSessionPluginUiEdit) => void
  /** Cells across the body the mod laid out for; the root is exactly this wide when given. */
  columns?: number
}): React.JSX.Element | null {
  if (node.type === 'engine') {
    return null
  }
  const style = {
    ...PLUGIN_CELL_ROOT_STYLE,
    width: columns === undefined ? undefined : pluginCellsX(columns)
  } as CSSProperties
  return (
    <div
      className={cn(PLUGIN_CELL_FONT_CLASS, 'flex min-w-0 flex-col text-chat-foreground')}
      style={style}
    >
      <PluginElement node={node} context={{ target, onPress, onEdit }} />
    </div>
  )
}
