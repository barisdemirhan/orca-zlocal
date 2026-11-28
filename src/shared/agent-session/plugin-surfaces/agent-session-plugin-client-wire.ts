import type {
  AgentSessionPluginJson,
  AgentSessionPluginUiComponent
} from './agent-session-plugin-surface-wire'

/** Where a `Client` node sits: its render site, its key in the tree and the surface module it names. */
export type AgentSessionPluginClientAddress = {
  plugin: string
  component: AgentSessionPluginUiComponent
  instanceId: string
  client: string
  module: string
}

/** What happened to an element a surface module drew inside a `Client`. */
export type AgentSessionPluginClientEvent =
  | { type: 'press' }
  | { type: 'input'; kind: 'change' | 'submit'; value: string }
  | { type: 'select'; value: string }

export type AgentSessionPluginClientFaultPhase = 'load' | 'render' | 'run'

/** A request a `Client`'s surface runtime makes of the engine that runs the session. */
export type AgentSessionPluginClientCall =
  | { kind: 'module'; plugin: string }
  | ({
      kind: 'press'
      element: string
      event: AgentSessionPluginClientEvent
    } & AgentSessionPluginClientAddress)
  | ({ kind: 'message'; data: AgentSessionPluginJson } & AgentSessionPluginClientAddress)
  | ({
      kind: 'fault'
      phase: AgentSessionPluginClientFaultPhase
      reason: string
    } & AgentSessionPluginClientAddress)

/** The compiled surface modules of one plugin, as the engine serves them. */
export type AgentSessionPluginClientModules = {
  plugin: string
  hash: string
  modules: { module: string; entry: string; component: string }[]
  runtime: string
  limits: { nodes: number; depth: number; chars: number; values: number; dataDepth: number }
  files: { key: string; source: string }[]
}

/** What each call answers; null when the engine has nothing to say (a stale or unknown instance). */
export type AgentSessionPluginClientAnswer =
  | AgentSessionPluginClientModules
  | { handled: boolean; reached?: Record<string, AgentSessionPluginJson> }
  | { props?: AgentSessionPluginJson }
  | null

export type AgentSessionPluginClientCaller = (
  sessionId: string,
  call: AgentSessionPluginClientCall
) => Promise<AgentSessionPluginClientAnswer>
