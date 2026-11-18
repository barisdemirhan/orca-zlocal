import { AGENT_HUB_ORB_OPENING_PROMPT } from '../../../agent-hub-orb'
import type {
  NativeChatBlock,
  NativeChatMessage,
  NativeChatTextBlock
} from '../../native-chat-types'

type ProviderFrameTextBlock = Extract<NativeChatBlock, { type: 'text' }>

export function nativeChatProviderFrameSummary(block: ProviderFrameTextBlock): string {
  const frame = block.providerFrame
  if (!frame) {
    return block.text
  }
  return block.text === `${frame.provider} · ${frame.kind}` ? frame.kind : block.text
}

/** Claude's answer to a local slash command (`/usage`); its words ride the payload's `content`. */
export const CLAUDE_LOCAL_COMMAND_OUTPUT_FRAME_KIND = 'message:system:local_command_output'

/** Codex's plan update: wordless, but the task list is read from it. */
export const CODEX_PLAN_UPDATED_FRAME_KIND = 'notification:turn/plan/updated'

/** The fields the wordless check reads: a journal status row, or the text block it projects to. */
export type ProviderFrameRowText = {
  text: string
  tone?: string
  presentation?: string
  failure?: unknown
  providerFrame?: { provider: string; kind: string }
}

function codexHookErrorText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('run' in payload)) {
    return null
  }
  const run = payload.run
  if (
    typeof run !== 'object' ||
    run === null ||
    !('entries' in run) ||
    !Array.isArray(run.entries)
  ) {
    return null
  }
  const errors: string[] = []
  const entries: unknown[] = run.entries
  for (const entry of entries) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'kind' in entry &&
      entry.kind === 'error' &&
      'text' in entry &&
      typeof entry.text === 'string' &&
      entry.text.trim()
    ) {
      errors.push(entry.text.trim())
    }
  }
  return errors.join('\n') || null
}

export function nativeChatHookErrorSummary(block: ProviderFrameTextBlock): string | null {
  const frame = block.providerFrame
  if (
    frame?.provider !== 'codex' ||
    frame.kind !== 'notification:hook/completed' ||
    frame.payload.truncated ||
    block.failure !== undefined ||
    block.presentation !== undefined ||
    block.text !== `${frame.provider} · ${frame.kind}`
  ) {
    return null
  }
  try {
    const payload: unknown = JSON.parse(frame.payload.head)
    return codexHookErrorText(payload)
  } catch {
    return null
  }
}

/** Codex wraps API request failures in a JSON string; keep the sentence in view. */
export function nativeChatCodexApiErrorSummary(row: ProviderFrameRowText): string | null {
  if (
    row.providerFrame?.provider !== 'codex' ||
    row.providerFrame.kind !== 'notification:error' ||
    row.tone !== 'error' ||
    row.presentation !== undefined ||
    row.failure !== undefined
  ) {
    return null
  }
  try {
    const envelope: unknown = JSON.parse(row.text)
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('type' in envelope) ||
      envelope.type !== 'error' ||
      !('status' in envelope) ||
      typeof envelope.status !== 'number' ||
      !Number.isInteger(envelope.status) ||
      envelope.status < 400 ||
      envelope.status > 599 ||
      !('error' in envelope) ||
      typeof envelope.error !== 'object' ||
      envelope.error === null ||
      !('type' in envelope.error) ||
      envelope.error.type !== 'invalid_request_error' ||
      !('message' in envelope.error) ||
      typeof envelope.error.message !== 'string' ||
      !envelope.error.message.trim()
    ) {
      return null
    }
    return envelope.error.message.trim()
  } catch {
    return null
  }
}

// Why: Codex reports the review verdict as either a plain or a guardian warning frame.
const APPROVED_REVIEW_FRAME_KINDS: ReadonlySet<string> = new Set([
  'notification:warning',
  'notification:guardianWarning'
])

export function nativeChatApprovedReviewSummary(row: ProviderFrameRowText): string | null {
  if (
    row.providerFrame?.provider !== 'codex' ||
    !APPROVED_REVIEW_FRAME_KINDS.has(row.providerFrame.kind) ||
    row.tone !== 'warning' ||
    row.presentation !== undefined ||
    row.failure !== undefined
  ) {
    return null
  }
  return /^Automatic approval review approved \(risk: (?:low|medium|high), authorization: (?:low|medium|high)\):\s+\S/.test(
    row.text
  )
    ? 'Automatic approval review approved'
    : null
}

/** Optional MCP startup health stays inspectable without competing with the answer. */
export function isCodexMcpStartupNotice(row: ProviderFrameRowText): boolean {
  return (
    row.providerFrame?.provider === 'codex' &&
    row.providerFrame.kind === 'notification:mcpServer/startupStatus/updated' &&
    row.tone === 'error' &&
    row.presentation === undefined &&
    row.failure === undefined
  )
}

function isOrbOpeningMessage(message: NativeChatMessage | undefined): boolean {
  if (message?.role !== 'user') {
    return false
  }
  return isOrbOpeningText(
    message.blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
  )
}

/** Covers older Orb prompts too, which no longer match the current text exactly. */
export function isOrbOpeningText(text: string): boolean {
  const trimmed = text.trim()
  return trimmed === AGENT_HUB_ORB_OPENING_PROMPT || trimmed.startsWith("You are Orca's Orb")
}

export type NativeChatConnectionWarning = { id: string; block: NativeChatTextBlock }

export function nativeChatOrbConversationMessages(messages: readonly NativeChatMessage[]): {
  messages: readonly NativeChatMessage[]
  connectionWarnings: readonly NativeChatConnectionWarning[]
} {
  const visible: NativeChatMessage[] = []
  const connectionWarnings: NativeChatConnectionWarning[] = []
  let startup = isOrbOpeningMessage(messages.find((message) => message.role === 'user'))
  for (const message of messages) {
    if (isOrbOpeningMessage(message)) {
      continue
    }
    if (message.role === 'user') {
      startup = false
    }
    const blocks = message.blocks.filter((block, index) => {
      if (block.type !== 'text' || message.role !== 'system') {
        return true
      }
      if (nativeChatApprovedReviewSummary(block)) {
        return false
      }
      if (isCodexMcpStartupNotice(block) || (startup && nativeChatHookErrorSummary(block))) {
        connectionWarnings.push({ id: `${message.id}:${index}`, block })
        return false
      }
      return true
    })
    if (blocks.length > 0) {
      visible.push(blocks.length === message.blocks.length ? message : { ...message, blocks })
    }
  }
  return { messages: visible, connectionWarnings }
}

/**
 * An unrecognised provider event stored with no words of its own: the host's fallback label is
 * its only text. Kept in the journal for readers of the frame (the Codex task list), never drawn.
 * A failure or notice (any tone) and a request Orca already answered stay visible. The host's
 * per-turn row cap reads this same rule, so a row no client draws never fills it.
 */
export function isWordlessProviderFrame(row: ProviderFrameRowText): boolean {
  const frame = row.providerFrame
  return (
    frame !== undefined &&
    row.tone === undefined &&
    row.presentation === undefined &&
    row.failure === undefined &&
    !frame.kind.startsWith('request:') &&
    // Older hosts stored a local command's output only in the payload; the row keeps it there.
    !(frame.provider === 'claude' && frame.kind === CLAUDE_LOCAL_COMMAND_OUTPUT_FRAME_KIND) &&
    row.text === `${frame.provider} · ${frame.kind}`
  )
}

export function isWordlessProviderFrameBlock(block: NativeChatBlock): boolean {
  return block.type === 'text' && isWordlessProviderFrame(block)
}

export function isWordlessProviderFrameMessage(message: NativeChatMessage): boolean {
  return message.blocks.length > 0 && message.blocks.every(isWordlessProviderFrameBlock)
}
