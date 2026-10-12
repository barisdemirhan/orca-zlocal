import { z } from 'zod'

// Only the local IPC bridge uses this opt-in; remote admission uses authenticated capabilities.
export const ClientEventsSubscribeParams = z
  .object({ agentHub: z.boolean().optional() })
  .nullable()
  .default({})

export const ClientEventsUnsubscribeParams = z.object({
  subscriptionId: z
    .unknown()
    .transform((value) => (typeof value === 'string' && value.length > 0 ? value : ''))
    .pipe(z.string().min(1, 'Missing subscriptionId'))
})
