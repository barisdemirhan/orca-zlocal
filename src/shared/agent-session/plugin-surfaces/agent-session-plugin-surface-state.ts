import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
  AgentSessionPluginPromptFill,
  AgentSessionPluginStatus,
  AgentSessionPluginToast
} from './agent-session-plugin-surface-wire'

const RETAINED_PLUGIN_TOASTS = 8
const RETAINED_PLUGIN_PROMPT_FILLS = 8

/** Live status lines, restated by the host on every open, and the newest toasts a consumer fires once each. */
export type AgentSessionPluginSurfaceState = {
  statuses: AgentSessionPluginStatus[]
  toasts: AgentSessionPluginToast[]
  promptFills: AgentSessionPluginPromptFill[]
  promptHint: AgentSessionPluginNode | null
  pane: AgentSessionPluginPane | null
  band: AgentSessionPluginNode | null
}

type PluginSurfaceFrame = {
  pluginStatuses?: AgentSessionPluginStatus[]
  pluginToasts?: AgentSessionPluginToast[]
  pluginPromptFills?: AgentSessionPluginPromptFill[]
  pluginPromptHint?: AgentSessionPluginNode | null
  pluginPane?: AgentSessionPluginPane | null
  pluginBand?: AgentSessionPluginNode | null
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
    frame.pluginPromptFills === undefined &&
    (frame.pluginStatuses === undefined ||
      statusesEqual(frame.pluginStatuses, current?.statuses ?? [])) &&
    (frame.pluginPromptHint === undefined ||
      treesEqual(frame.pluginPromptHint, current?.promptHint)) &&
    (frame.pluginPane === undefined || treesEqual(frame.pluginPane, current?.pane)) &&
    (frame.pluginBand === undefined || treesEqual(frame.pluginBand, current?.band))
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
    frame.pluginPromptFills === undefined &&
    frame.pluginPromptHint === undefined &&
    frame.pluginPane === undefined &&
    frame.pluginBand === undefined
  ) {
    return {}
  }
  const held = current?.toasts ?? []
  const known = new Set(held.map((toast) => toast.id))
  const heldFills = current?.promptFills ?? []
  const knownFills = new Set(heldFills.map((fill) => fill.id))
  return {
    plugins: {
      statuses: frame.pluginStatuses ?? current?.statuses ?? [],
      promptHint:
        frame.pluginPromptHint === undefined
          ? (current?.promptHint ?? null)
          : frame.pluginPromptHint,
      pane: frame.pluginPane === undefined ? (current?.pane ?? null) : frame.pluginPane,
      band: frame.pluginBand === undefined ? (current?.band ?? null) : frame.pluginBand,
      toasts: [
        ...held,
        ...(frame.pluginToasts ?? []).filter((toast) => !known.has(toast.id))
      ].slice(-RETAINED_PLUGIN_TOASTS),
      promptFills: [
        ...heldFills,
        ...(frame.pluginPromptFills ?? []).filter((fill) => !knownFills.has(fill.id))
      ].slice(-RETAINED_PLUGIN_PROMPT_FILLS)
    }
  }
}
