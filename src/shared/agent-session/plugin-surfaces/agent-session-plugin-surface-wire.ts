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

/** What one provider frame changes: the whole status list, or one toast. */
export type AgentSessionPluginSurfaceUpdate = {
  statuses?: AgentSessionPluginStatus[]
  toast?: AgentSessionPluginToast
}
