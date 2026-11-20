import { z } from 'zod'

export const PluginUiPressParams = z
  .object({
    sessionId: z.string().min(1),
    component: z.enum(['PromptHint', 'Pane']),
    instanceId: z.string().min(1).max(256),
    plugin: z.string().min(1).max(256),
    handle: z.number().int(),
    key: z.string().max(256).optional()
  })
  .strict()
