import type { ReactNode } from 'react'
import { NativeChatMarkdown } from '../markdown/NativeChatMarkdown'
import { openUrlRequestPage } from '../prompts/NativeChatUrlRequest'
import { readNumber, readString, type PluginProps } from './plugin-prop-values'
import { PLUGIN_LINK_COLOR } from './plugin-theme-colors'

export function PluginLink({
  props,
  children
}: {
  props: PluginProps
  children: ReactNode
}): React.JSX.Element {
  const href = readString(props.href) ?? ''
  const isWeb = /^https?:\/\//i.test(href)
  return (
    <a
      href={isWeb ? href : undefined}
      rel="noreferrer"
      className="min-w-0 cursor-pointer underline [overflow-wrap:anywhere]"
      style={{ color: PLUGIN_LINK_COLOR }}
      onClick={(event) => {
        event.preventDefault()
        openUrlRequestPage(href)
      }}
    >
      {children}
    </a>
  )
}

export function PluginMarkdown({ props }: { props: PluginProps }): React.JSX.Element {
  return (
    <div
      className={
        props.dimColor === true
          ? 'min-w-0 text-chat-foreground-faint [&_*]:text-[length:inherit] [&_*]:leading-[inherit]'
          : 'min-w-0 [&_*]:text-[length:inherit] [&_*]:leading-[inherit]'
      }
    >
      <NativeChatMarkdown content={readString(props.text) ?? ''} />
    </div>
  )
}

/** An SVG as an <img>, which the browser never lets run script. */
export function PluginSvg({ props }: { props: PluginProps }): React.JSX.Element | null {
  const source = readString(props.source)
  if (!source || !source.trimStart().startsWith('<svg')) {
    return null
  }
  return (
    <img
      alt={readString(props.alt) ?? ''}
      className="max-w-full"
      width={readNumber(props.width)}
      height={readNumber(props.height)}
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`}
    />
  )
}
