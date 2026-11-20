import type {
  AgentSessionPluginJson,
  AgentSessionPluginNode
} from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

export const MAX_PLUGIN_TREE_DEPTH = 24
export const MAX_PLUGIN_TREE_NODES = 1500
export const MAX_PLUGIN_TREE_STRING = 2000
export const MAX_PLUGIN_TREE_BYTES = 96_000
const MAX_COLLECTION_ENTRIES = 200
const MAX_TYPE_LENGTH = 64

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cappedString(value: string): string {
  return value.length > MAX_PLUGIN_TREE_STRING
    ? `${value.slice(0, MAX_PLUGIN_TREE_STRING - 1)}…`
    : value
}

function plainJson(value: unknown, depth: number): AgentSessionPluginJson | undefined {
  if (typeof value === 'string') {
    return cappedString(value)
  }
  if (typeof value === 'boolean' || value === null) {
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (depth >= MAX_PLUGIN_TREE_DEPTH) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_COLLECTION_ENTRIES).flatMap((entry) => {
      const kept = plainJson(entry, depth + 1)
      return kept === undefined ? [] : [kept]
    })
  }
  if (isRecord(value)) {
    const out: Record<string, AgentSessionPluginJson> = {}
    for (const key of Object.keys(value).slice(0, MAX_COLLECTION_ENTRIES)) {
      const kept = key === '__proto__' ? undefined : plainJson(value[key], depth + 1)
      if (kept !== undefined) {
        out[key] = kept
      }
    }
    return out
  }
  return undefined
}

function sanitizeNode(
  raw: unknown,
  depth: number,
  budget: { nodes: number }
): AgentSessionPluginNode | null {
  if (
    depth > MAX_PLUGIN_TREE_DEPTH ||
    budget.nodes >= MAX_PLUGIN_TREE_NODES ||
    !isRecord(raw) ||
    typeof raw.type !== 'string' ||
    raw.type === '' ||
    raw.type.length > MAX_TYPE_LENGTH
  ) {
    return null
  }
  budget.nodes += 1
  const node: AgentSessionPluginNode = { type: raw.type }
  if (isRecord(raw.props)) {
    const props = plainJson(raw.props, depth)
    if (isRecord(props) && Object.keys(props).length > 0) {
      node.props = props as Record<string, AgentSessionPluginJson>
    }
  }
  if (Array.isArray(raw.children)) {
    const children: (AgentSessionPluginNode | string)[] = []
    for (const child of raw.children) {
      if (typeof child === 'string') {
        children.push(cappedString(child))
      } else {
        const kept = sanitizeNode(child, depth + 1, budget)
        if (kept) {
          children.push(kept)
        }
      }
    }
    if (children.length > 0) {
      node.children = children
    }
  }
  const press = raw.press
  if (
    isRecord(press) &&
    typeof press.plugin === 'string' &&
    press.plugin !== '' &&
    typeof press.handle === 'number' &&
    Number.isSafeInteger(press.handle)
  ) {
    node.press = { plugin: cappedString(press.plugin), handle: press.handle }
  }
  return node
}

/** A tree the chat can render safely, or null when the value is not a tree or exceeds the size caps. */
export function sanitizePluginTree(raw: unknown): AgentSessionPluginNode | null {
  const tree = sanitizeNode(raw, 1, { nodes: 0 })
  return tree && JSON.stringify(tree).length <= MAX_PLUGIN_TREE_BYTES ? tree : null
}

/** False for a tree made only of the host's own `engine` placeholders, which Orca omits. */
export function pluginTreeDrawsContent(node: AgentSessionPluginNode | string): boolean {
  if (typeof node === 'string') {
    return true
  }
  if (node.type === 'engine') {
    return false
  }
  if (node.type !== 'Box') {
    return true
  }
  return (node.children ?? []).some(pluginTreeDrawsContent)
}
