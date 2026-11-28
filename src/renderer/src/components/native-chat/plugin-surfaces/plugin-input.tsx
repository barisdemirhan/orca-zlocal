import { useEffect, useState } from 'react'
import type {
  AgentSessionPluginUiEdit,
  AgentSessionPluginUiPress
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { pluginCellsX } from './plugin-cell-metrics'
import { readNumber, readString, type PluginProps } from './plugin-prop-values'
import { PLUGIN_FAINT_COLOR } from './plugin-theme-colors'

const FIELD_CLASS =
  'm-0 min-w-0 shrink appearance-none border-0 bg-transparent p-0 font-[inherit] text-[length:inherit] leading-[inherit] text-inherit outline-none placeholder:text-[color:var(--plugin-faint)]'

/** An Input as the terminal draws it, `label: field ⏎ submit`, the field as wide as its text. */
export function PluginInput({
  props,
  press,
  target,
  onEdit
}: {
  props: PluginProps
  press: { plugin: string; handle: number } | undefined
  target: Pick<AgentSessionPluginUiPress, 'component' | 'instanceId'>
  onEdit: ((edit: AgentSessionPluginUiEdit) => void) | undefined
}): React.JSX.Element {
  const drawn = readString(props.value) ?? ''
  const [value, setValue] = useState(drawn)
  useEffect(() => setValue(drawn), [drawn])
  const label = readString(props.label)
  const placeholder = readString(props.placeholder) ?? ''
  const rows = Math.max(1, Math.floor(readNumber(props.rows) ?? 1))
  const key = readString(props.key)
  const send = (edit: AgentSessionPluginUiEdit['edit'], text: string): void => {
    if (press && onEdit) {
      onEdit({ ...target, ...press, ...(key !== undefined ? { key } : {}), edit, value: text })
    }
  }
  const change = (text: string): void => {
    setValue(text)
    send('change', text)
  }
  // The text and the cursor cell after it, or the placeholder the cursor sits on.
  const width = pluginCellsX(Math.max(value.length + 1, placeholder.length))
  const field =
    rows > 1 ? (
      <textarea
        className={`${FIELD_CLASS} resize-none`}
        style={{ width }}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        disabled={!press}
        onChange={(event) => change(event.target.value)}
      />
    ) : (
      <input
        className={FIELD_CLASS}
        style={{ width }}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        disabled={!press}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send('submit', value)
          }
        }}
      />
    )
  return (
    <div
      className="flex max-w-full min-w-0 items-start whitespace-pre"
      style={{ '--plugin-faint': PLUGIN_FAINT_COLOR } as React.CSSProperties}
    >
      {label ? <span className="shrink-0">{label}: </span> : null}
      {field}
      {/* A flex row drops a bare space, so the gap before ⏎ is a cell of its own. */}
      <span className="shrink-0"> </span>
      <button
        type="button"
        disabled={!press}
        onClick={() => send('submit', value)}
        className="m-0 shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-[length:inherit] leading-[inherit] text-inherit outline-none enabled:hover:bg-chat-foreground enabled:hover:text-chat-canvas enabled:focus-visible:bg-chat-foreground enabled:focus-visible:text-chat-canvas"
      >
        ⏎ {readString(props.submitLabel) ?? 'submit'}
      </button>
    </div>
  )
}
