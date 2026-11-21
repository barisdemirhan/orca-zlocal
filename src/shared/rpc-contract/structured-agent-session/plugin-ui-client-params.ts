import { z } from 'zod'
import type { AgentSessionPluginJson } from '../../agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

const pluginJson: z.ZodType<AgentSessionPluginJson> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(pluginJson),
    z.record(z.string(), pluginJson)
  ])
)

const address = {
  plugin: z.string().min(1).max(256),
  component: z.enum(['PromptHint', 'Pane', 'AbovePrompt']),
  instanceId: z.string().min(1).max(256),
  client: z.string().min(1).max(256),
  module: z.string().min(1).max(512)
}

export const PluginUiClientParams = z
  .object({
    sessionId: z.string().min(1),
    call: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('module'), plugin: z.string().min(1).max(256) }).strict(),
      z
        .object({
          kind: z.literal('press'),
          ...address,
          element: z.string().max(256),
          event: z.discriminatedUnion('type', [
            z.object({ type: z.literal('press') }).strict(),
            z
              .object({
                type: z.literal('input'),
                kind: z.enum(['change', 'submit']),
                value: z.string().max(100_000)
              })
              .strict(),
            z.object({ type: z.literal('select'), value: z.string().max(100_000) }).strict()
          ])
        })
        .strict(),
      z.object({ kind: z.literal('message'), ...address, data: pluginJson }).strict(),
      z
        .object({
          kind: z.literal('fault'),
          ...address,
          phase: z.enum(['load', 'render', 'run']),
          reason: z.string().max(200)
        })
        .strict()
    ])
  })
  .strict()
