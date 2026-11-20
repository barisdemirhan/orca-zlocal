/** One plugin's status line; the host keeps at most one per plugin. */
export type AgentSessionPluginStatus = {
  plugin: string
  text: string
}

/** A one-shot notice a plugin raised; `id` is stable so several views of one session show it once. */
export type AgentSessionPluginToast = {
  id: string
  plugin: string
  text: string
  timeoutMs: number
}

export type AgentSessionPluginJson =
  | string
  | number
  | boolean
  | null
  | AgentSessionPluginJson[]
  | { [key: string]: AgentSessionPluginJson }

/** One element a mod drew, reduced to what the chat renders; a string child is plain text. */
export type AgentSessionPluginNode = {
  type: string
  props?: Record<string, AgentSessionPluginJson>
  children?: (AgentSessionPluginNode | string)[]
  press?: { plugin: string; handle: number }
}

/** The mod pane Claude Code reports as shown, with its latest drawing. */
export type AgentSessionPluginPane = {
  id: string
  title: string
  plugin: string
  tree: AgentSessionPluginNode
}

/** The render sites a press can name. */
export type AgentSessionPluginUiComponent = 'PromptHint' | 'Pane'

/** The plugin fields of a batch frame; never sent to phones. */
export type AgentSessionPluginSurfaceFields = {
  /** Whole current list of status lines; empty clears, absent keeps. */
  pluginStatuses?: AgentSessionPluginStatus[]
  /** One-shot toasts for this frame only; never replayed to a later subscriber. */
  pluginToasts?: AgentSessionPluginToast[]
  /** The tree a mod drew under the composer; null clears, absent keeps. */
  pluginPromptHint?: AgentSessionPluginNode | null
  /** The mod pane showing now; null clears, absent keeps. */
  pluginPane?: AgentSessionPluginPane | null
}

/** A press on an element a mod drew: where it was drawn and the handle it carried. */
export type AgentSessionPluginUiPress = {
  component: AgentSessionPluginUiComponent
  instanceId: string
  plugin: string
  handle: number
  key?: string
}

/** What one provider frame changes: the whole status list, one toast, or a drawn tree (null clears it). */
export type AgentSessionPluginSurfaceUpdate = {
  statuses?: AgentSessionPluginStatus[]
  toast?: AgentSessionPluginToast
  promptHint?: AgentSessionPluginNode | null
  pane?: AgentSessionPluginPane | null
}

/** What a new process starts with: no status lines and nothing drawn. */
export const AGENT_SESSION_PLUGIN_SURFACES_RESET: AgentSessionPluginSurfaceUpdate = {
  statuses: [],
  promptHint: null,
  pane: null
}
