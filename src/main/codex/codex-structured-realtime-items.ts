import { z } from 'zod'

const Identity = {
  id: z.string().min(1).max(1024),
  realtimeSessionId: z.string().min(1).max(1024)
}
export const CodexRealtimeTranscriptSchema = z.object({
  ...Identity,
  type: z.literal('transcriptSegment'),
  role: z.enum(['user', 'assistant']),
  text: z.string().max(256 * 1024)
})
const Presentation = z.discriminatedUnion('type', [
  z.object({ type: z.literal('wholeItem') }),
  z.object({ type: z.literal('inlineMarkdown') }),
  z.object({
    type: z.literal('inlineVisualization'),
    index: z.number().int().nonnegative().max(0xffff_ffff)
  })
])

/** Native 0.163.0 canonical items; validate a whole page before admitting any rows. */
export const CodexRealtimeItemSchema = z.discriminatedUnion('type', [
  CodexRealtimeTranscriptSchema,
  z.object({ ...Identity, type: z.literal('realtimeSessionStarted') }),
  z.object({
    ...Identity,
    type: z.literal('realtimeSessionClosed'),
    outcome: z.enum(['ended', 'failed'])
  }),
  z.object({
    ...Identity,
    type: z.literal('bemItemPromoted'),
    turn_id: z.string().min(1).max(1024),
    item_id: z.string().min(1).max(1024),
    presentation: Presentation
  })
])

const SNAKE_CASE_FIELDS: Readonly<Record<string, string>> = {
  turnId: 'turn_id',
  itemId: 'item_id',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  durationMs: 'duration_ms'
}

function withSnakeCaseFields(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }
  const normalized: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value)) {
    normalized[key] = field
  }
  for (const [camel, snake] of Object.entries(SNAKE_CASE_FIELDS)) {
    if (camel in normalized && !(snake in normalized)) {
      normalized[snake] = normalized[camel]
      delete normalized[camel]
    }
  }
  return normalized
}

/** Why: codex-cli 0.163.0 sends camelCase turn and promoted-item fields while its generated schema
 *  says snake_case; accept both so a page is not rejected whole. */
export function normalizeCodexTimelineEntry(entry: unknown): unknown {
  if (typeof entry !== 'object' || entry === null || !('type' in entry)) {
    return entry
  }
  if (entry.type === 'turnStarted' || entry.type === 'turnCompleted') {
    return withSnakeCaseFields(entry)
  }
  if (entry.type === 'realtime' && 'item' in entry) {
    const item = entry.item
    return typeof item === 'object' &&
      item !== null &&
      'type' in item &&
      item.type === 'bemItemPromoted'
      ? { ...entry, item: withSnakeCaseFields(item) }
      : entry
  }
  return entry
}
