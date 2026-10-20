import { z } from 'zod'

const identity = z.string().min(1).max(2_000)
const target = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('terminal'),
    ptyId: identity,
    paneKey: identity.optional(),
    terminalHandle: identity
  }),
  z.object({ kind: z.literal('session'), sessionId: identity }),
  z.object({ kind: z.literal('pane'), paneKey: identity, terminalHandle: identity })
])
export type AgentHubOrbOperationTarget = z.infer<typeof target>

export const AgentHubOrbOperationSchema = z.object({
  id: z.string().uuid(),
  sessionId: identity,
  method: z.string().max(100),
  target,
  active: z.boolean()
})
export type AgentHubOrbOperation = z.infer<typeof AgentHubOrbOperationSchema>
