import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
  AgentSessionPluginUiAction,
  AgentSessionPluginUiEdit,
  AgentSessionPluginUiPress
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { NativeChatDockTranscript } from '../pane/dock/NativeChatDock'
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
import { inlinePluginPaneRows } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-pane-rows'
import { PluginClientProvider } from './client/plugin-client-context'
import type { PluginClientTransport } from './client/plugin-client-host'

const BAND_INSTANCE = 'above-prompt'
const CONTENT_COLUMN = 'mx-auto w-full max-w-(--chat-content-max-width)'
// The composer's own gutter, so a box framed here lines up with the composer's card.
const COMPOSER_GUTTER_STYLE = {
  ...PLUGIN_CELL_ROOT_STYLE,
  '--composer-atomic-width': 'calc(var(--spacing) * 10)'
} as React.CSSProperties

export type NativeChatPluginFrameSurfaces = {
  pluginPane?: AgentSessionPluginPane
  pluginBand?: AgentSessionPluginNode
  actOnPluginUi?: (action: AgentSessionPluginUiAction) => void
  isWorking?: boolean
}

/** The terminal's ✕: one faint cell, its hit area a little wider than the glyph. */
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
        'relative w-(--plugin-cell) text-chat-foreground-faint before:absolute before:-inset-x-1.5 before:inset-y-0 hover:text-chat-foreground focus-visible:text-chat-foreground focus-visible:outline-none',
        className
      )}
    >
      ✕
    </button>
  )
}

/** The terminal's tabs when several panes are open: ` title ` a cell apart, the shown one bold and inverse. */
function PaneTabs({
  pane,
  act
}: {
  pane: AgentSessionPluginPane
  act: (action: AgentSessionPluginUiAction) => void
}): React.JSX.Element | null {
  if (!pane.tabs) {
    return null
  }
  return (
    <div role="tablist" className="flex min-w-0 gap-(--plugin-cell) overflow-hidden whitespace-pre">
      {pane.tabs.map((tab) => {
        const isShown = tab.id === pane.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isShown}
            onClick={() => (isShown ? undefined : act({ kind: 'show', paneId: tab.id }))}
            className={cn(
              'shrink-0 px-(--plugin-cell) focus-visible:underline focus-visible:outline-none',
              isShown ? 'bg-chat-foreground font-bold text-chat-canvas' : 'hover:underline'
            )}
          >
            {tab.title}
          </button>
        )
      })}
    </div>
  )
}

/** Docked beside the transcript like the terminal from 110 columns: a raised panel, a left rule, × on a row of its own. */
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
        'flex min-h-0 shrink-0 flex-col border-l border-chat-composer-border bg-chat-composer-surface pl-[calc(var(--plugin-cell)/2)]',
        PLUGIN_CELL_FONT_CLASS
      )}
      style={{
        ...PLUGIN_CELL_ROOT_STYLE,
        width: `calc(${pluginCellsX(layout.dockColumns + 0.5)} + 1px)`
      }}
    >
      <div className="flex shrink-0 justify-between gap-(--plugin-cell) pr-(--plugin-cell)">
        <PaneTabs pane={pane} act={act} />
        <PaneClose pane={pane} act={act} className="ml-auto" />
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <NativeChatPluginTree
          node={pane.tree}
          columns={layout.paneColumns}
          target={{ component: 'Pane', instanceId: pane.id }}
          onPress={press}
          onEdit={(edit: AgentSessionPluginUiEdit) => act({ kind: 'input', ...edit })}
        />
      </div>
    </section>
  )
}

/** Framed above the composer like the narrow terminal: a rounded rule as wide as the composer, × sitting on it. */
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
  return (
    <section
      aria-label={pane.title}
      className={cn(
        // The terminal's rule fills a whole cell row, so half a row sits between it and the body.
        'relative mt-[calc(var(--plugin-row)/2)] rounded-md border border-chat-composer-border px-[calc(var(--plugin-cell)*1.5)] py-[calc(var(--plugin-row)/2)]',
        PLUGIN_CELL_FONT_CLASS
      )}
    >
      <PaneClose
        pane={pane}
        act={act}
        className="absolute -top-[calc(var(--plugin-row)/2+0.5px)] right-[calc(var(--plugin-cell)*1.5-1px)] bg-chat-canvas"
      />
      <PaneTabs pane={pane} act={act} />
      <div
        className="scrollbar-sleek overflow-x-hidden overflow-y-auto"
        style={{ maxHeight: pluginCellsY(inlinePluginPaneRows(layout.rows) - (pane.tabs ? 1 : 0)) }}
      >
        <NativeChatPluginTree
          node={pane.tree}
          columns={layout.paneColumns}
          target={{ component: 'Pane', instanceId: pane.id }}
          onPress={press}
          onEdit={(edit: AgentSessionPluginUiEdit) => act({ kind: 'input', ...edit })}
        />
      </div>
    </section>
  )
}

/** The rows mods stack above the prompt, short of the terminal's five end cells, where its faint [-] sits. */
function PluginBand({
  band,
  layout,
  press,
  setCollapsed
}: {
  band: AgentSessionPluginNode
  layout: NativeChatPluginLayout
  press: (press: AgentSessionPluginUiPress) => void
  setCollapsed: (isCollapsed: boolean) => void
}): React.JSX.Element {
  const t = useTranslate()
  // The toggle swaps buttons; focus follows so the keyboard keeps its place.
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const hadFocus = useRef(false)
  const toggle = (isCollapsed: boolean): void => {
    hadFocus.current = document.activeElement === toggleRef.current
    setCollapsed(isCollapsed)
  }
  useLayoutEffect(() => {
    if (hadFocus.current) {
      hadFocus.current = false
      toggleRef.current?.focus()
    }
  }, [layout.isBandCollapsed])
  if (layout.isBandCollapsed) {
    return (
      <button
        ref={toggleRef}
        type="button"
        onClick={() => toggle(false)}
        className={cn(
          'block max-w-full truncate text-left text-chat-foreground-faint hover:bg-chat-foreground hover:text-chat-canvas focus-visible:bg-chat-foreground focus-visible:text-chat-canvas focus-visible:outline-none',
          PLUGIN_CELL_FONT_CLASS
        )}
      >
        {t('components.native-chat.pluginBand.collapsed', '▸ plugin panel hidden · click to show')}
      </button>
    )
  }
  const label = t('components.native-chat.pluginBand.collapse', 'Hide plugin panel')
  return (
    <div className={cn('relative', PLUGIN_CELL_FONT_CLASS)}>
      <div
        className="scrollbar-sleek overflow-x-hidden overflow-y-auto"
        style={{
          width: pluginCellsX(layout.bandColumns),
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
      <button
        type="button"
        aria-label={label}
        ref={toggleRef}
        title={label}
        onClick={() => toggle(true)}
        className="absolute top-0 right-(--plugin-cell) whitespace-pre text-chat-foreground-faint hover:bg-chat-foreground hover:text-chat-canvas focus-visible:bg-chat-foreground focus-visible:text-chat-canvas focus-visible:outline-none"
      >
        [-]
      </button>
    </div>
  )
}

/** Seats what mods drew around the transcript: the pane docked or inline, and the band above the composer. */
export function NativeChatPluginFrame({
  plugins,
  transcript,
  footer
}: {
  plugins: NativeChatPluginFrameSurfaces
  transcript: React.ReactNode
  footer?: React.ReactNode
}): React.JSX.Element {
  const { pluginPane: pane, pluginBand: band, actOnPluginUi: act } = plugins
  const [isBandCollapsed, setBandCollapsed] = useState(false)
  const { frameRef, columnRef, probeRef, layout } = useNativeChatPluginLayout({
    pane,
    isWorking: plugins.isWorking ?? false,
    isBandCollapsed,
    report: act ? (layout) => act({ kind: 'layout', ...layout }) : undefined
  })
  const press = (target: AgentSessionPluginUiPress): void => act?.({ kind: 'press', ...target })
  const docked = pane && act && layout?.placement === 'dock'
  // The terminal gives the inline pane the band's room while it is open.
  const inline = pane && act && layout && !docked
  const showsBand = band && layout && !inline
  return (
    <div
      ref={frameRef}
      className="flex min-h-0 flex-1 flex-row"
      style={
        layout ? ({ '--plugin-cell': `${layout.cellWidth}px` } as React.CSSProperties) : undefined
      }
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {transcript}
        <div
          className={cn(
            'native-chat-composer-gutter shrink-0',
            (inline || showsBand) && 'pb-[calc(var(--plugin-row)-0.5rem)]'
          )}
          style={COMPOSER_GUTTER_STYLE}
        >
          <div className={CONTENT_COLUMN}>
            <div ref={columnRef} className="h-0 w-full" aria-hidden />
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
            {inline ? <InlinePane pane={pane} layout={layout} act={act} press={press} /> : null}
            {showsBand ? (
              <PluginBand
                band={band}
                layout={layout}
                press={press}
                setCollapsed={setBandCollapsed}
              />
            ) : null}
          </div>
        </div>
        {footer}
      </div>
      {docked ? <DockedPane pane={pane} layout={layout} act={act} press={press} /> : null}
    </div>
  )
}

/** Wraps a native chat's transcript and footer with what mods drew for it, as the terminal seats them. */
export function NativeChatPluginTranscript({
  plugins,
  children,
  footer
}: {
  plugins: NativeChatPluginFrameSurfaces & { callPluginUiClient?: PluginClientTransport }
  children: React.ReactNode
  /** The dock, seated in the chat column below the band, so a docked pane runs beside the composer too. */
  footer?: React.ReactNode
}): React.JSX.Element {
  const transcript = <NativeChatDockTranscript>{children}</NativeChatDockTranscript>
  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      <PluginClientProvider transport={plugins.callPluginUiClient}>
        <NativeChatPluginFrame plugins={plugins} transcript={transcript} footer={footer} />
      </PluginClientProvider>
    </div>
  )
}
