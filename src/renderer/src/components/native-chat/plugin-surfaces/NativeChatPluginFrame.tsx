import { X } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
  AgentSessionPluginUiAction,
  AgentSessionPluginUiPress
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { NativeChatPluginTree } from './NativeChatPluginTree'
import {
  PLUGIN_CELL_FONT_CLASS,
  PLUGIN_CELL_ROOT_STYLE,
  pluginCellsX,
  pluginCellsY
} from './plugin-cell-metrics'
import {
  useNativeChatPluginLayout,
  type NativeChatPluginLayout
} from './use-native-chat-plugin-layout'

const BAND_INSTANCE = 'above-prompt'
const CONTENT_COLUMN = 'mx-auto w-full max-w-(--chat-content-max-width) px-[5px]'

export type NativeChatPluginFrameSurfaces = {
  pluginPane?: AgentSessionPluginPane
  pluginBand?: AgentSessionPluginNode
  actOnPluginUi?: (action: AgentSessionPluginUiAction) => void
  isWorking?: boolean
}

function PaneClose({
  pane,
  act,
  className
}: {
  pane: AgentSessionPluginPane
  act: (action: AgentSessionPluginUiAction) => void
  className?: string
}): React.JSX.Element {
  const t = useTranslate()
  const label = t('components.native-chat.pluginPane.close', 'Close pane')
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => act({ kind: 'close', paneId: pane.id })}
      className={cn(
        'flex size-[1lh] items-center justify-center rounded-sm text-chat-foreground-faint hover:bg-accent hover:text-chat-foreground focus-visible:ring-1 focus-visible:ring-chat-focus-ring focus-visible:outline-none',
        className
      )}
    >
      <X className="size-3" />
    </button>
  )
}

/** Docked beside the transcript like the terminal from 110 columns: a left rule, × on a row of its own. */
function DockedPane({
  pane,
  layout,
  act,
  press
}: {
  pane: AgentSessionPluginPane
  layout: NativeChatPluginLayout
  act: (action: AgentSessionPluginUiAction) => void
  press: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element {
  return (
    <section
      aria-label={pane.title}
      className={cn(
        'flex min-h-0 shrink-0 flex-col border-l border-chat-composer-border',
        PLUGIN_CELL_FONT_CLASS
      )}
      style={{
        ...PLUGIN_CELL_ROOT_STYLE,
        width: `calc(${pluginCellsX(layout.dockColumns + 1)} + 1px)`
      }}
    >
      <div className="flex shrink-0 justify-end px-[0.5ch]">
        <PaneClose pane={pane} act={act} />
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[0.5ch]">
        <NativeChatPluginTree
          node={pane.tree}
          columns={layout.paneColumns}
          target={{ component: 'Pane', instanceId: pane.id }}
          onPress={press}
        />
      </div>
    </section>
  )
}

/** Framed above the composer like the narrow terminal: a rounded border with × sitting on it. */
function InlinePane({
  pane,
  layout,
  act,
  press
}: {
  pane: AgentSessionPluginPane
  layout: NativeChatPluginLayout
  act: (action: AgentSessionPluginUiAction) => void
  press: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element {
  const maxRows = Math.max(4, Math.min(pane.rows ?? layout.rows, Math.floor(layout.rows / 2)))
  return (
    <div className={cn(CONTENT_COLUMN, 'shrink-0 pt-2')}>
      <section
        aria-label={pane.title}
        className={cn(
          'relative rounded-md border border-chat-composer-border px-[0.5ch]',
          PLUGIN_CELL_FONT_CLASS
        )}
        style={PLUGIN_CELL_ROOT_STYLE}
      >
        <PaneClose
          pane={pane}
          act={act}
          className="absolute -top-[0.5lh] right-[1ch] bg-chat-canvas"
        />
        <div
          className="scrollbar-sleek overflow-x-hidden overflow-y-auto"
          style={{ maxHeight: pluginCellsY(maxRows) }}
        >
          <NativeChatPluginTree
            node={pane.tree}
            columns={layout.paneColumns}
            target={{ component: 'Pane', instanceId: pane.id }}
            onPress={press}
          />
        </div>
      </section>
    </div>
  )
}

/** Seats what mods drew around the transcript: the pane docked or inline, and the band above the composer. */
export function NativeChatPluginFrame({
  plugins,
  transcript
}: {
  plugins: NativeChatPluginFrameSurfaces
  transcript: React.ReactNode
}): React.JSX.Element {
  const { pluginPane: pane, pluginBand: band, actOnPluginUi: act } = plugins
  const { frameRef, columnRef, probeRef, layout } = useNativeChatPluginLayout({
    pane,
    isWorking: plugins.isWorking ?? false,
    report: act ? (layout) => act({ kind: 'layout', ...layout }) : undefined
  })
  const press = (target: AgentSessionPluginUiPress): void => act?.({ kind: 'press', ...target })
  const docked = pane && act && layout?.placement === 'dock'
  return (
    <div ref={frameRef} className="flex min-h-0 flex-1 flex-row">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {transcript}
        {pane && act && layout && !docked ? (
          <InlinePane pane={pane} layout={layout} act={act} press={press} />
        ) : null}
        <div className={cn(CONTENT_COLUMN, 'shrink-0')}>
          <div ref={columnRef} className="h-0 w-full" aria-hidden />
          <span
            ref={probeRef}
            aria-hidden
            className={cn(
              'pointer-events-none invisible absolute whitespace-pre',
              PLUGIN_CELL_FONT_CLASS
            )}
            style={PLUGIN_CELL_ROOT_STYLE}
          >
            0000000000
          </span>
          {band && layout ? (
            <div
              className="scrollbar-sleek overflow-x-hidden overflow-y-auto pt-1"
              style={{
                ...PLUGIN_CELL_ROOT_STYLE,
                maxHeight: pluginCellsY(Math.floor(layout.rows / 2))
              }}
            >
              <NativeChatPluginTree
                node={band}
                columns={layout.bandColumns}
                target={{ component: 'AbovePrompt', instanceId: BAND_INSTANCE }}
                onPress={press}
              />
            </div>
          ) : null}
        </div>
      </div>
      {docked ? <DockedPane pane={pane} layout={layout} act={act} press={press} /> : null}
    </div>
  )
}
