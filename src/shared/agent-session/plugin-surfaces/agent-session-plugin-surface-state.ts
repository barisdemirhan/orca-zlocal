import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
  AgentSessionPluginStatus,
  AgentSessionPluginToast
} from './agent-session-plugin-surface-wire'

const RETAINED_PLUGIN_TOASTS = 8

/** Live status lines, restated by the host on every open, and the newest toasts a consumer fires once each. */
export type AgentSessionPluginSurfaceState = {
  statuses: AgentSessionPluginStatus[]
  toasts: AgentSessionPluginToast[]
  promptHint: AgentSessionPluginNode | null
  pane: AgentSessionPluginPane | null
}

type PluginSurfaceFrame = {
  pluginStatuses?: AgentSessionPluginStatus[]
  pluginToasts?: AgentSessionPluginToast[]
  pluginPromptHint?: AgentSessionPluginNode | null
  pluginPane?: AgentSessionPluginPane | null
}

// Trees are capped by the host, so comparing their JSON stays cheap.
function treesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function statusesEqual(
  left: readonly AgentSessionPluginStatus[],
  right: readonly AgentSessionPluginStatus[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) => entry.plugin === right[index].plugin && entry.text === right[index].text
    )
  )
}

/** A frame that restates the current status lines and carries no toast changes nothing. */
export function pluginSurfacesRestated(
  frame: PluginSurfaceFrame,
  current: AgentSessionPluginSurfaceState | undefined
): boolean {
  return (
    frame.pluginToasts === undefined &&
    (frame.pluginStatuses === undefined ||
      statusesEqual(frame.pluginStatuses, current?.statuses ?? [])) &&
    (frame.pluginPromptHint === undefined ||
      treesEqual(frame.pluginPromptHint, current?.promptHint)) &&
    (frame.pluginPane === undefined || treesEqual(frame.pluginPane, current?.pane))
  )
}

/** Empty when the frame carries neither; a toast already held is not added twice and old ones fall away. */
export function pluginSurfacesAfterBatch(
  current: AgentSessionPluginSurfaceState | undefined,
  frame: PluginSurfaceFrame
): { plugins?: AgentSessionPluginSurfaceState } {
  if (
    frame.pluginStatuses === undefined &&
    frame.pluginToasts === undefined &&
    frame.pluginPromptHint === undefined &&
    frame.pluginPane === undefined
  ) {
    return {}
  }
  const held = current?.toasts ?? []
  const known = new Set(held.map((toast) => toast.id))
  return {
    plugins: {
      statuses: frame.pluginStatuses ?? current?.statuses ?? [],
      promptHint:
        frame.pluginPromptHint === undefined
          ? (current?.promptHint ?? null)
          : frame.pluginPromptHint,
      pane: frame.pluginPane === undefined ? (current?.pane ?? null) : frame.pluginPane,
      toasts: [
        ...held,
        ...(frame.pluginToasts ?? []).filter((toast) => !known.has(toast.id))
      ].slice(-RETAINED_PLUGIN_TOASTS)
    }
  }
}
