import { z } from 'zod'
import type { CodexAppServerConnection } from './app-server/codex-app-server-connection-types'
import { isCodexAppServerRequestError } from './app-server/codex-app-server-request-error'
import { CodexAppServerUnsupportedError } from './app-server/codex-app-server-session'
import {
  CodexRealtimeItemSchema,
  normalizeCodexTimelineEntry
} from './codex-structured-realtime-items'
import {
  CODEX_RESTORE_MAX_BYTES,
  CODEX_RESTORE_MAX_OPERATIONS
} from './structured/journal/codex-structured-journal-translation-restore'

const TimelineItem = z.object({ id: z.string().min(1), type: z.string().min(1) }).passthrough()
const Position = z.number().int().nonnegative()
const Timestamp = z.number().int().nullable().optional()
const TimelineEntry = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('item'),
    position: Position,
    turnId: z.string().min(1),
    item: TimelineItem
  }),
  z.object({
    type: z.literal('realtime'),
    position: Position,
    item: CodexRealtimeItemSchema
  }),
  z.object({
    type: z.literal('turnStarted'),
    position: Position,
    turn_id: z.string().min(1),
    started_at: Timestamp
  }),
  z.object({
    type: z.literal('turnCompleted'),
    position: Position,
    turn_id: z.string().min(1),
    status: z.string().min(1),
    started_at: Timestamp,
    completed_at: Timestamp,
    duration_ms: Timestamp,
    error: z.unknown().optional()
  })
])
const TimelinePage = z.object({
  data: z
    .array(z.unknown())
    .max(50)
    .transform((entries) => entries.map(normalizeCodexTimelineEntry))
    .pipe(z.array(TimelineEntry)),
  nextCursor: z.string().min(1).max(4096).nullable().optional(),
  activeRealtimeSessionAtPageStart: z.string().nullable().optional()
})

export type CodexTimelineEntry = z.infer<typeof TimelineEntry>
export type CodexTimelineRead =
  | { status: 'ready'; entries: CodexTimelineEntry[] }
  | { status: 'unsupported' | 'unknown' | 'limit' }

/** Read every bounded page before admitting any history, so a partial read cannot claim restore. */
export async function readCodexRealtimeTimeline(
  connection: Pick<CodexAppServerConnection, 'request'>,
  threadId: string,
  timeoutMs = 5_000
): Promise<CodexTimelineRead> {
  const entries: CodexTimelineEntry[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  let bytes = 0
  try {
    for (let page = 0; page < 100; page += 1) {
      const raw = await connection.request(
        'thread/timeline/list',
        { threadId, limit: 50, ...(cursor ? { cursor } : {}) },
        { timeoutMs: Math.min(timeoutMs, 5_000) }
      )
      bytes += Buffer.byteLength(JSON.stringify(raw ?? null), 'utf8')
      const parsed = TimelinePage.safeParse(raw)
      if (bytes > CODEX_RESTORE_MAX_BYTES) {
        return { status: 'limit' }
      }
      if (!parsed.success) {
        return { status: 'unknown' }
      }
      entries.push(...parsed.data.data)
      if (entries.length > CODEX_RESTORE_MAX_OPERATIONS) {
        return { status: 'limit' }
      }
      cursor = parsed.data.nextCursor ?? null
      if (!cursor) {
        entries.sort((left, right) => left.position - right.position)
        if (
          entries.some(
            (entry, index) => index > 0 && entries[index - 1]?.position === entry.position
          )
        ) {
          return { status: 'unknown' }
        }
        return { status: 'ready', entries }
      }
      if (seen.has(cursor)) {
        return { status: 'unknown' }
      }
      seen.add(cursor)
    }
  } catch (error) {
    return {
      status:
        error instanceof CodexAppServerUnsupportedError ||
        (isCodexAppServerRequestError(error) && error.code === -32601)
          ? 'unsupported'
          : 'unknown'
    }
  }
  return { status: 'unknown' }
}
