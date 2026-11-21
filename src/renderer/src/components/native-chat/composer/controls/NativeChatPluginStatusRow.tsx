import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginStatus,
  AgentSessionPluginUiPress
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { NativeChatPluginTree } from '../../plugin-surfaces/NativeChatPluginTree'
import { PLUGIN_CELL_FONT_CLASS, PLUGIN_ROW_REM } from '../../plugin-surfaces/plugin-cell-metrics'

/** Rows a hint draws above itself, where the terminal's footer has a row (Tycoon's toggle sits there). */
function rowsAboveHint(hint: AgentSessionPluginNode): number {
  let rows = 0
  for (const child of hint.children ?? []) {
    if (typeof child !== 'string' && child.props?.position === 'absolute') {
      const top = child.props.top
      rows = typeof top === 'number' && top < 0 ? Math.max(rows, -top) : rows
    }
  }
  return rows
}

/** The mod hint under the prompt: on the terminal's grid, two cells in from the composer's edge. */
function PromptHint({
  hint,
  onPress
}: {
  hint: AgentSessionPluginNode
  onPress: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element {
  // Outside the plugin frame, so this row measures its own cell.
  const probeRef = useRef<HTMLSpanElement | null>(null)
  const [cell, setCell] = useState<number>()
  useLayoutEffect(() => {
    const probe = probeRef.current
    if (!probe) {
      return
    }
    const measure = (): void => setCell(probe.getBoundingClientRect().width / 10)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(probe)
    return () => observer.disconnect()
  }, [])
  const style = {
    ...(cell ? { '--plugin-cell': `${cell}px` } : {}),
    // The row's own px-3 counts toward the two cells.
    marginLeft: 'calc(var(--plugin-cell, 1ch) * 2 - 0.75rem)',
    paddingTop: `${rowsAboveHint(hint) * PLUGIN_ROW_REM}rem`
  } as React.CSSProperties
  return (
    <li className="relative flex min-w-0 max-w-full items-center" style={style}>
      <span
        ref={probeRef}
        aria-hidden
        className={cn(
          'pointer-events-none invisible absolute whitespace-pre',
          PLUGIN_CELL_FONT_CLASS
        )}
      >
        0000000000
      </span>
      <NativeChatPluginTree
        node={hint}
        target={{ component: 'PromptHint', instanceId: 'prompt-hint' }}
        onPress={onPress}
      />
    </li>
  )
}

export function NativeChatPluginStatusRow({
  statuses,
  hint,
  onPress
}: {
  statuses: readonly AgentSessionPluginStatus[] | undefined
  /** A mod's drawn prompt hint, shown in the same row as the status lines. */
  hint?: AgentSessionPluginNode
  onPress?: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  if (!statuses?.length && !(hint && onPress)) {
    return null
  }
  return (
    <ul
      aria-label={t('components.native-chat.pluginStatus.label', 'Plugin status')}
      className="flex min-w-0 flex-wrap items-center gap-x-3 px-3 text-2xs text-chat-foreground-faint"
    >
      {hint && onPress ? <PromptHint hint={hint} onPress={onPress} /> : null}
      {statuses?.map(({ plugin, text }) => (
        <li
          key={plugin}
          title={`${plugin}: ${text}`}
          className="flex min-w-0 max-w-full items-baseline gap-1"
        >
          <span className="shrink-0 opacity-70">{plugin}</span>
          <span className="min-w-0 truncate whitespace-nowrap">{text}</span>
        </li>
      ))}
    </ul>
  )
}
