import type {
  AgentSessionPluginPane,
  AgentSessionPluginUiComponent,
  AgentSessionPluginUiLayout
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

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
  isWorking: false,
  isDraft: false
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

/** The chat's size as Claude Code's `viewport`; the chat has no scrollback mode, so it reads as fullscreen. */
export function pluginUiViewport(layout: AgentSessionPluginUiLayout): Record<string, unknown> {
  return { columns: layout.columns, rows: layout.rows, isFullscreen: true }
}

/** The props the terminal hands each render site, sized to the chat (see the `claude-code` d.ts). */
export function pluginUiSiteProps(
  instance: PluginUiInstance,
  layout: AgentSessionPluginUiLayout,
  pane: PluginPaneEntry | undefined
): Record<string, unknown> {
  const halfRows = Math.max(4, Math.floor(layout.rows / 2))
  switch (instance.component) {
    case 'PromptHint':
      return { isDraft: layout.isDraft, isWorking: layout.isWorking, hint: '' }
    case 'AbovePrompt':
      return {
        hasSurvey: false,
        isCollapsed: false,
        isWorking: layout.isWorking,
        maxRows: halfRows,
        bodyColumns: layout.bandColumns,
        scroll: { offset: 0, bodyRows: halfRows - 1 },
        view: {}
      }
    case 'Pane': {
      const bodyRows =
        layout.placement === 'dock'
          ? Math.max(4, layout.rows - 1)
          : Math.max(4, Math.min(pane?.rows ?? halfRows, halfRows) - 2)
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
