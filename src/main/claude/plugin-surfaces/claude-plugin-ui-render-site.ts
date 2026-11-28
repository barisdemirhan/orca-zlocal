import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
  AgentSessionPluginUiComponent,
  AgentSessionPluginUiLayout
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import {
  dockedPluginPaneRows,
  inlinePluginPaneRows
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-pane-rows'

export type PluginUiInstance = { component: AgentSessionPluginUiComponent; instanceId: string }
export type PluginPaneEntry = Omit<AgentSessionPluginPane, 'tree'>

const MAX_TEXT = 200
const MAX_CELLS = 2000

/** What the bridge assumes until a chat view reports its size. */
export const DEFAULT_PLUGIN_UI_LAYOUT: AgentSessionPluginUiLayout = {
  columns: 100,
  rows: 40,
  placement: 'inline',
  paneColumns: 96,
  bandColumns: 95,
  hintColumns: 100,
  isWorking: false,
  isDraft: false,
  isBandCollapsed: false
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function pluginUiText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, MAX_TEXT) : null
}

function cells(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_CELLS
    ? value
    : undefined
}

export function readPluginPaneEntry(entry: unknown): PluginPaneEntry | null {
  const id = isRecord(entry) ? pluginUiText(entry.id) : null
  if (!isRecord(entry) || !id) {
    return null
  }
  const columns = cells(entry.columns)
  const rows = cells(entry.rows)
  return {
    id,
    title: pluginUiText(entry.title) ?? id,
    plugin: pluginUiText(entry.plugin) ?? id,
    ...(columns ? { columns } : {}),
    ...(rows ? { rows } : {})
  }
}

/** The shown pane as the chat draws it, every open pane a tab when there are several. */
export function paneWithTabs(
  pane: PluginPaneEntry,
  tree: AgentSessionPluginNode,
  panes: readonly PluginPaneEntry[]
): AgentSessionPluginPane {
  const tabs = panes.map(({ id, title }) => ({ id, title }))
  return { ...pane, tree, ...(tabs.length > 1 ? { tabs } : {}) }
}

/**
 * The chat's size as Claude Code's `viewport`; the chat has no scrollback mode, so it reads as fullscreen.
 * The prompt hint lays out across the viewport, so it gets the row under the composer as its width.
 */
export function pluginUiViewport(
  layout: AgentSessionPluginUiLayout,
  component?: PluginUiInstance['component']
): Record<string, unknown> {
  const columns = component === 'PromptHint' ? layout.hintColumns : layout.columns
  return { columns, rows: layout.rows, isFullscreen: true }
}

/** The props the terminal hands each render site, sized to the chat (see the `claude-code` d.ts). */
export function pluginUiSiteProps(
  instance: PluginUiInstance,
  layout: AgentSessionPluginUiLayout,
  pane: PluginPaneEntry | undefined,
  hasTabs = false
): Record<string, unknown> {
  const halfRows = Math.max(4, Math.floor(layout.rows / 2))
  switch (instance.component) {
    case 'PromptHint':
      return { isDraft: layout.isDraft, isWorking: layout.isWorking, hint: '' }
    case 'AbovePrompt':
      return {
        hasSurvey: false,
        isCollapsed: layout.isBandCollapsed,
        isWorking: layout.isWorking,
        maxRows: halfRows,
        bodyColumns: layout.bandColumns,
        scroll: { offset: 0, bodyRows: halfRows - 1 },
        view: {}
      }
    case 'Pane': {
      const bodyRows =
        layout.placement === 'dock'
          ? dockedPluginPaneRows(layout.rows)
          : // Inline, the tabs take the box's first row.
            inlinePluginPaneRows(layout.rows) - (hasTabs ? 1 : 0)
      return {
        title: pane?.title ?? instance.instanceId,
        isFocused: false,
        bodyColumns: layout.paneColumns,
        placement: layout.placement,
        scroll: { offset: 0, bodyRows },
        view: {}
      }
    }
  }
}
