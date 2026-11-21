import { z } from 'zod'

const cells = z.number().int().min(1).max(2000)
const pressed = {
  component: z.enum(['PromptHint', 'Pane', 'AbovePrompt']),
  instanceId: z.string().min(1).max(256),
  plugin: z.string().min(1).max(256),
  handle: z.number().int(),
  key: z.string().max(256).optional()
}
const paneId = z.string().min(1).max(64)

export const PluginUiActionParams = z
  .object({
    sessionId: z.string().min(1),
    action: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('press'), ...pressed }).strict(),
      z
        .object({
          kind: z.literal('input'),
          ...pressed,
          edit: z.enum(['change', 'submit']),
          // Claude Code refuses a longer field.
          value: z.string().max(16384)
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
          hintColumns: cells,
          isWorking: z.boolean(),
          isDraft: z.boolean(),
          isBandCollapsed: z.boolean()
        })
        .strict(),
      z.object({ kind: z.literal('close'), paneId }).strict(),
      z.object({ kind: z.literal('show'), paneId }).strict()
    ])
  })
  .strict()
