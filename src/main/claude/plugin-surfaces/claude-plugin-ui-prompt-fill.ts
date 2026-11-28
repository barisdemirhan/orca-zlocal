import { randomUUID } from 'node:crypto'
import type { AgentSessionPluginSurfaceUpdate } from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import type { AgentSessionPluginPromptFill } from '../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

const MAX_PROMPT_FILL_LENGTH = 20_000
const FILL_MODES = new Set<AgentSessionPluginPromptFill['mode']>(['replace', 'append', 'insert'])

/** The fill a `ui_prompt_fill` body asks for, without its id; null when the body is unusable. */
function readPluginPromptFill(
  body: Record<string, unknown>
): Omit<AgentSessionPluginPromptFill, 'id'> | null {
  const { text, mode, cursor } = body
  if (typeof text !== 'string' || text === '' || text.length > MAX_PROMPT_FILL_LENGTH) {
    return null
  }
  const fillMode =
    mode === undefined
      ? 'replace'
      : FILL_MODES.has(mode as AgentSessionPluginPromptFill['mode'])
        ? (mode as AgentSessionPluginPromptFill['mode'])
        : null
  if (!fillMode) {
    return null
  }
  return {
    text,
    mode: fillMode,
    ...(typeof cursor === 'number' && Number.isInteger(cursor) && cursor >= 0 ? { cursor } : {})
  }
}

/** Answers the engine's `ui_prompt_fill` at once, since it waits only 5 s: the composer gets the text through a one-shot frame. */
export function answerPluginPromptFill(
  body: Record<string, unknown>,
  publish: (update: AgentSessionPluginSurfaceUpdate) => void
): { filled: boolean } {
  const fill = readPluginPromptFill(body)
  if (!fill) {
    return { filled: false }
  }
  publish({ promptFill: { id: randomUUID(), ...fill } })
  return { filled: true }
}
