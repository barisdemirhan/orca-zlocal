import { z } from 'zod'

// Remote opt-in still requires the authenticated capability; ordinary streams opt out.
export const ClientEventsSubscribeParams = z
  .object({
    agentHub: z.boolean().optional(),
    // Only the desktop renderer opts in; main-process relays on the same socket cannot answer host requests.
    browserHostRequests: z.boolean().optional()
  })
  .nullable()
  .default({})

export const ClientEventsUnsubscribeParams = z.object({
  subscriptionId: z
    .unknown()
    .transform((value) => (typeof value === 'string' && value.length > 0 ? value : ''))
    .pipe(z.string().min(1, 'Missing subscriptionId'))
})
