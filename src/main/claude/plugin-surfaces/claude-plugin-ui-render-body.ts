import type { AgentSessionPluginUiLayout } from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import {
  pluginUiSiteProps,
  pluginUiViewport,
  type PluginPaneEntry,
  type PluginUiInstance
} from './claude-plugin-ui-render-site'

export function pluginUiRenderBody(
  surface: string,
  clientId: string,
  instance: PluginUiInstance,
  layout: AgentSessionPluginUiLayout,
  panes: PluginPaneEntry[]
): Record<string, unknown> {
  return {
    surface,
    client_id: clientId,
    component: instance.component,
    instance_id: instance.instanceId,
    viewport: pluginUiViewport(layout, instance.component),
    props: pluginUiSiteProps(
      instance,
      layout,
      panes.find((pane) => pane.id === instance.instanceId),
      panes.length > 1
    )
  }
}
