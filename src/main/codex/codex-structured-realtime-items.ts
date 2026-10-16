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
