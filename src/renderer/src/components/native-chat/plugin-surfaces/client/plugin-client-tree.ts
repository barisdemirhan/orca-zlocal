import type {
  AgentSessionPluginJson,
  AgentSessionPluginNode
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

const MAX_DEPTH = 40
const MAX_TYPE_LENGTH = 64
/** What a surface module cannot draw inside its region; the runtime refuses them, and so does the chat. */
const UNDRAWABLE = new Set(['Client', 'Raster', 'Image', 'Progress', 'engine'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function adapt(
  raw: unknown,
  plugin: string,
  depth: number,
  budget: { nodes: number }
): AgentSessionPluginNode | null {
  if (
    depth > MAX_DEPTH ||
    budget.nodes <= 0 ||
    !isRecord(raw) ||
    typeof raw.type !== 'string' ||
    raw.type.length > MAX_TYPE_LENGTH ||
    UNDRAWABLE.has(raw.type)
  ) {
    return null
  }
  budget.nodes -= 1
  const node: AgentSessionPluginNode = { type: raw.type }
  if (isRecord(raw.props)) {
    node.props = raw.props as Record<string, AgentSessionPluginJson>
  }
  if (Array.isArray(raw.children)) {
    const children: (AgentSessionPluginNode | string)[] = []
    for (const child of raw.children) {
      const kept = typeof child === 'string' ? child : adapt(child, plugin, depth + 1, budget)
      if (kept !== null) {
        children.push(kept)
      }
    }
    node.children = children
  }
  // The runtime numbers each held closure; the chat's element engine knows that as a press handle.
  if (raw.type === 'Button' && typeof raw.held === 'number' && Number.isSafeInteger(raw.held)) {
    node.press = { plugin, handle: raw.held }
  }
  return node
}

/** The tree a surface runtime exported as JSON text, as the chat's element engine draws it; null when unusable. */
export function readPluginClientTree(
  text: string,
  plugin: string,
  maxNodes: number
): AgentSessionPluginNode | null {
  try {
    return adapt(JSON.parse(text), plugin, 1, { nodes: maxNodes })
  } catch {
    return null
  }
}
