import { z } from 'zod'

export const AGENT_HUB_DEFAULT_ASK_TIMEOUT_MS = 30 * 60_000
export const AGENT_HUB_MAX_ASK_TIMEOUT_MS = 24 * 60 * 60_000
export const AGENT_HUB_UI_TIMEOUT_MS = 10_000

const identity = z.string().trim().min(1).max(512)
const caller = z
  .object({
    callerTerminalHandle: identity.optional(),
    callerPaneKey: identity.optional(),
    callerSessionId: identity.optional(),
    terminal: identity.optional()
  })
  .refine(
    (value) => Boolean(value.callerTerminalHandle || value.callerPaneKey || value.callerSessionId),
    'Run hub commands inside an Orca terminal'
  )
const text = z.string().trim().min(1).max(8_000)
const link = z.string().trim().min(1).max(4_096)

export const AgentHubNotifyParams = caller.and(
  z.object({
    text,
    level: z.enum(['info', 'done', 'needs-you']).default('info'),
    sound: z.boolean().default(false),
    links: z.array(link).max(20).default([])
  })
)
export const AgentHubPeekParams = caller.and(z.object({ link }))
export const AgentHubAskParams = caller.and(
  z
    .object({
      question: text.optional(),
      options: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20).optional(),
      recommended: z.number().int().min(1).optional(),
      multi: z.boolean().default(false),
      timeoutMs: z
        .number()
        .int()
        .min(1)
        .max(AGENT_HUB_MAX_ASK_TIMEOUT_MS)
        .default(AGENT_HUB_DEFAULT_ASK_TIMEOUT_MS),
      ifAway: z.literal('recommended').optional(),
      waitMs: z.number().int().min(1).max(AGENT_HUB_MAX_ASK_TIMEOUT_MS).optional(),
      requestId: z.string().uuid().optional(),
      resume: z.string().uuid().optional()
    })
    .superRefine((value, ctx) => {
      const invalid = (message: string): void => {
        ctx.addIssue({ code: 'custom', message })
      }
      if (value.waitMs !== undefined && value.waitMs > value.timeoutMs) {
        invalid('--wait cannot exceed --timeout')
      }
      if (value.resume) {
        if (
          value.question ||
          value.options ||
          value.requestId ||
          value.recommended ||
          value.ifAway ||
          value.multi
        ) {
          invalid('Resume only accepts the question ID, timeout and wait')
        }
      } else {
        if (!value.question || !value.options) {
          invalid('A question and at least one --option are required')
        }
        if (value.recommended && value.recommended > (value.options?.length ?? 0)) {
          invalid('--recommended must name an option (one-based)')
        }
        if (value.ifAway && !value.recommended) {
          invalid('--if-away recommended requires --recommended')
        }
      }
    })
)
export const AgentHubProgressParams = caller.and(
  z
    .object({
      text: z.string().trim().min(1).max(80).optional(),
      clear: z.boolean().default(false)
    })
    .refine((value) => Boolean(value.text) !== value.clear, 'Choose progress text or --clear')
)
export const AgentHubPresenceParams = caller
export const AgentHubStatusParams = caller
export const AgentHubMirrorParams = caller.and(
  z.object({ action: z.enum(['open', 'add', 'minimize', 'restore', 'close']) })
)
export const AgentHubArrangeParams = caller.and(
  z.object({ layout: z.string().trim().min(1).max(80).optional() })
)
export const AgentHubCanvasParams = caller.and(z.object({ action: z.enum(['open', 'close']) }))

const pane = z.object({ paneKey: identity, terminalHandle: identity })
export const AgentHubResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ack') }),
  z.object({
    kind: z.literal('ask'),
    answer: z.string().max(8_000),
    index: z.number().int().min(1).nullable(),
    indices: z.array(z.number().int().min(1)).max(20).optional()
  }),
  z.object({
    kind: z.literal('presence'),
    present: z.boolean(),
    idleMinutes: z.number().finite().min(0)
  }),
  z.object({
    kind: z.literal('status'),
    mirrors: z.array(pane).max(500),
    parked: z.array(pane).max(500),
    waiting: z.array(pane).max(500),
    orbFocus: z.object({ pinned: pane.nullable(), following: z.array(pane).max(500) }).optional()
  }),
  z.object({ kind: z.literal('consent'), decision: z.enum(['once', 'session', 'deny']) }),
  z.object({
    kind: z.literal('error'),
    code: z.enum(['disabled_by_user', 'denied_by_user', 'invalid_argument']),
    message: z.string().max(1_000)
  })
])
export const AgentHubRespondParams = z.object({
  requestId: z.string().uuid(),
  result: AgentHubResponseSchema
})
export const AgentHubRespondResultSchema = z.object({
  requestId: z.string().uuid(),
  accepted: z.literal(true)
})
