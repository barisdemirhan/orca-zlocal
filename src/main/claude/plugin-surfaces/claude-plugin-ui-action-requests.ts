import type { AgentSessionPluginUiAction } from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import type { PluginUiInstance } from './claude-plugin-ui-render-site'

export type PluginUiRequestAction = Extract<
  AgentSessionPluginUiAction,
  { kind: 'input' | 'close' | 'show' }
>

/** The control request an edit, a tab pick or a close sends; null when it names nothing open. */
export function pluginUiActionRequest(
  action: PluginUiRequestAction,
  surface: string,
  clientId: string,
  panes: readonly { id: string }[],
  mounted: ReadonlyMap<string, PluginUiInstance>
): Record<string, unknown> | null {
  if (action.kind === 'input') {
    if (mounted.get(action.instanceId)?.component !== action.component) {
      return null
    }
    return {
      subtype: 'ui_input',
      plugin: action.plugin,
      handle: action.handle,
      kind: action.edit,
      value: action.value,
      ...(action.key ? { key: action.key } : {}),
      component: action.component,
      instance_id: action.instanceId,
      surface,
      client_id: clientId
    }
  }
  if (!panes.some((pane) => pane.id === action.paneId)) {
    return null
  }
  return action.kind === 'close'
    ? { subtype: 'ui_close', id: action.paneId, client_id: clientId }
    : { subtype: 'ui_pane_show', id: action.paneId, surface, client_id: clientId }
}
