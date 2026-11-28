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

/** A mod asking to put text in the prompt box; `id` is unique per fill so several views apply it once. */
export type AgentSessionPluginPromptFill = {
  id: string
  text: string
  mode: 'replace' | 'append' | 'insert'
  cursor?: number
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
  /** A `Client` node: the plugin whose surface module draws it, and that module set's hash. */
  client?: { plugin: string; hash?: string }
}

/** The mod pane Claude Code reports as shown, with its latest drawing. */
export type AgentSessionPluginPane = {
  id: string
  title: string
  plugin: string
  tree: AgentSessionPluginNode
  /** Cells across and rows the mod asked for; the chat docks the pane this wide. */
  columns?: number
  rows?: number
  /** Every open pane, in order, when more than one is: the terminal draws them as tabs. */
  tabs?: { id: string; title: string }[]
}

/** The render sites a press can name. */
export type AgentSessionPluginUiComponent = 'PromptHint' | 'Pane' | 'AbovePrompt'

/** Where the chat seats a mod pane: beside the transcript, or framed above the composer. */
export type AgentSessionPluginPanePlacement = 'dock' | 'inline'

/** The chat's size in monospace cells, which the mods lay their trees out in. */
export type AgentSessionPluginUiLayout = {
  columns: number
  rows: number
  placement: AgentSessionPluginPanePlacement
  paneColumns: number
  bandColumns: number
  /** The prompt hint's own width, which it reads as the viewport's columns. */
  hintColumns: number
  isWorking: boolean
  isDraft: boolean
  /** The band folded to one line by its [-], as the terminal's ctrl+x ctrl+a does. */
  isBandCollapsed: boolean
}

/** The plugin fields of a batch frame; never sent to phones. */
export type AgentSessionPluginSurfaceFields = {
  /** Whole current list of status lines; empty clears, absent keeps. */
  pluginStatuses?: AgentSessionPluginStatus[]
  /** One-shot toasts for this frame only; never replayed to a later subscriber. */
  pluginToasts?: AgentSessionPluginToast[]
  /** One-shot prompt fills for this frame only; never replayed to a later subscriber. */
  pluginPromptFills?: AgentSessionPluginPromptFill[]
  /** The tree a mod drew under the composer; null clears, absent keeps. */
  pluginPromptHint?: AgentSessionPluginNode | null
  /** The mod pane showing now; null clears, absent keeps. */
  pluginPane?: AgentSessionPluginPane | null
  /** The rows mods stacked in the band above the composer; null clears, absent keeps. */
  pluginBand?: AgentSessionPluginNode | null
}

/** A press on an element a mod drew: where it was drawn and the handle it carried. */
export type AgentSessionPluginUiPress = {
  component: AgentSessionPluginUiComponent
  instanceId: string
  plugin: string
  handle: number
  key?: string
}

/** An edit of an Input a mod drew: each change, or Enter. */
export type AgentSessionPluginUiEdit = AgentSessionPluginUiPress & {
  edit: 'change' | 'submit'
  value: string
}

/** What a view of the chat does to the mods' surfaces: a press, an edit, its size, or a pane picked or closed. */
export type AgentSessionPluginUiAction =
  | ({ kind: 'press' } & AgentSessionPluginUiPress)
  | ({ kind: 'input' } & AgentSessionPluginUiEdit)
  | ({ kind: 'layout' } & AgentSessionPluginUiLayout)
  | { kind: 'close'; paneId: string }
  | { kind: 'show'; paneId: string }

/** What one provider frame changes: the whole status list, one toast, or a drawn tree (null clears it). */
export type AgentSessionPluginSurfaceUpdate = {
  statuses?: AgentSessionPluginStatus[]
  toast?: AgentSessionPluginToast
  promptFill?: AgentSessionPluginPromptFill
  promptHint?: AgentSessionPluginNode | null
  pane?: AgentSessionPluginPane | null
  band?: AgentSessionPluginNode | null
}

/** What a new process starts with: no status lines and nothing drawn. */
export const AGENT_SESSION_PLUGIN_SURFACES_RESET: AgentSessionPluginSurfaceUpdate = {
  statuses: [],
  promptHint: null,
  pane: null,
  band: null
}
