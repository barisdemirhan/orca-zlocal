import { cn } from '@/lib/class-names'
import { readNumber, readString, type PluginProps } from './plugin-prop-values'
import { PLUGIN_ADDED_COLOR, PLUGIN_FAINT_COLOR, PLUGIN_REMOVED_COLOR } from './plugin-theme-colors'
import { pluginCellsX } from './plugin-cell-metrics'

function diffColor(line: string): string | undefined {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return PLUGIN_ADDED_COLOR
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return PLUGIN_REMOVED_COLOR
  }
  return line.startsWith('@@') ? PLUGIN_FAINT_COLOR : undefined
}

/** Source lines on the cell grid; a gutter only when the mod gave a start line. */
export function PluginCodeBlock({ props }: { props: PluginProps }): React.JSX.Element {
  const lines = (readString(props.source) ?? '').split('\n')
  const isDiff = props.format === 'diff'
  const startLine = isDiff ? undefined : readNumber(props.startLine)
  const gutter = startLine === undefined ? 0 : String(startLine + lines.length - 1).length + 1
  const cuts = props.wrap === 'truncate-end'
  return (
    <div className="min-w-0">
      {lines.map((line, index) => (
        <div key={index} className="flex min-w-0">
          {startLine !== undefined ? (
            <span
              className="shrink-0 text-right text-chat-foreground-faint"
              style={{ width: pluginCellsX(gutter) }}
            >
              {startLine + index}{' '}
            </span>
          ) : null}
          <span
            className={cn(
              'min-w-0 flex-1',
              cuts ? 'truncate whitespace-pre' : 'whitespace-pre-wrap [overflow-wrap:anywhere]'
            )}
            style={{ color: isDiff ? diffColor(line) : undefined }}
          >
            {line === '' ? ' ' : line}
          </span>
        </div>
      ))}
    </div>
  )
}
