import { z } from 'zod'
import { AgentHubOrbOperationSchema } from '../agent-hub-orb-operation'
import type { AgentHubDelivery, AgentHubEvent, AgentHubSnapshot } from '../agent-hub-requests'

const pane = z.object({ paneKey: z.string(), terminalHandle: z.string() })
const base = z.object({
  requestId: z.string().uuid(),
  caller: pane.extend({
    kind: z.enum(['pane', 'orb']).optional(),
    sessionId: z.string().optional(),
    agentType: z.string().optional(),
    title: z.string().optional()
  }),
  target: pane,
  createdAt: z.number().finite(),
  expiresAt: z.number().finite()
})
const peek = z.object({ kind: z.literal('peek'), link: z.string() })
const peekControl = z.object({ kind: z.literal('peek-control'), action: z.enum(['close', 'back']) })
const mirror = z.object({
  kind: z.literal('mirror'),
  action: z.enum(['open', 'add', 'minimize', 'restore', 'close']),
  into: pane.optional()
})
const arrange = z.object({ kind: z.literal('arrange'), layout: z.string().optional() })
const canvas = z.object({ kind: z.literal('canvas'), action: z.enum(['open', 'close']) })
const operation = z.discriminatedUnion('kind', [peek, peekControl, mirror, arrange, canvas])
const answer = z.object({
  answer: z.string(),
  index: z.number().int().min(1).nullable(),
  indices: z.array(z.number().int().min(1)).optional(),
  by: z.enum(['human', 'timeout', 'away-default']),
  desktop: z.string()
})

export const AgentHubEventSchema: z.ZodType<AgentHubEvent> = z.discriminatedUnion('kind', [
  base.extend({
    kind: z.literal('notify'),
    text: z.string(),
    level: z.enum(['info', 'done', 'needs-you']),
    sound: z.boolean(),
    links: z.array(z.string())
  }),
  base.extend({
    kind: z.literal('ask'),
    question: z.string(),
    options: z.array(z.string()),
    recommended: z.number().int().min(1).optional(),
    multi: z.boolean(),
    ifAway: z.literal('recommended').optional()
  }),
  base.extend({
    requestId: z.string().regex(/^gate_/),
    kind: z.literal('gate'),
    gateId: z.string(),
    runId: z.string(),
    taskId: z.string(),
    runTitle: z.string(),
    taskTitle: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    multi: z.literal(false)
  }),
  base.extend({ kind: z.literal('memory'), text: z.string() }),
  base.extend({ kind: z.literal('presence') }),
  base.extend({ kind: z.literal('status') }),
  base.extend(peek.shape),
  base.extend(peekControl.shape),
  base.extend(mirror.shape),
  base.extend(arrange.shape),
  base.extend(canvas.shape),
  base.extend({ kind: z.literal('consent'), operation }),
  base.extend({
    kind: z.literal('progress'),
    text: z.string().nullable(),
    orbOperation: AgentHubOrbOperationSchema.optional()
  }),
  base.extend({
    kind: z.literal('closed'),
    requestId: z.union([z.string().uuid(), z.string().regex(/^gate_/)]),
    gateId: z.string().optional(),
    reason: z.enum([
      'responded',
      'disabled',
      'not_found',
      'rate_limited',
      'no_desktop',
      'no_response',
      'denied_by_user',
      'disabled_by_user',
      'timeout',
      'already_resolved',
      'request_not_found',
      'invalid_argument',
      'connection_lost'
    ]),
    result: answer.optional()
  })
])
const snapshotEvents = z.array(z.unknown()).transform((items) =>
  items.flatMap((item) => {
    const parsed = AgentHubEventSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
)

export const AgentHubSnapshotSchema: z.ZodType<AgentHubSnapshot> = z.object({
  requests: snapshotEvents.transform((events) =>
    events.filter((event) => event.kind !== 'closed' && event.kind !== 'progress')
  ),
  progress: snapshotEvents.transform((events) =>
    events.filter((event) => event.kind === 'progress')
  )
})

export function readAgentHubDelivery(message: unknown): AgentHubDelivery | null {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return null
  }
  if (message.type === 'agentHub' && 'event' in message) {
    return AgentHubEventSchema.parse(message.event)
  }
  if (
    message.type === 'ready' &&
    'snapshot' in message &&
    typeof message.snapshot === 'object' &&
    message.snapshot !== null &&
    'agentHub' in message.snapshot
  ) {
    return { kind: 'snapshot', snapshot: AgentHubSnapshotSchema.parse(message.snapshot.agentHub) }
  }
  return null
}
