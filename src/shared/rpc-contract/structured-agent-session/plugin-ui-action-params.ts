import { z } from 'zod'

const cells = z.number().int().min(1).max(2000)

export const PluginUiActionParams = z
  .object({
    sessionId: z.string().min(1),
    action: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('press'),
          component: z.enum(['PromptHint', 'Pane', 'AbovePrompt']),
          instanceId: z.string().min(1).max(256),
          plugin: z.string().min(1).max(256),
          handle: z.number().int(),
          key: z.string().max(256).optional()
        })
        .strict(),
      z
        .object({
          kind: z.literal('layout'),
          columns: cells,
          rows: cells,
          placement: z.enum(['dock', 'inline']),
          paneColumns: cells,
          bandColumns: cells,
          isWorking: z.boolean(),
          isDraft: z.boolean()
        })
        .strict(),
      z.object({ kind: z.literal('close'), paneId: z.string().min(1).max(64) }).strict()
    ])
  })
  .strict()
