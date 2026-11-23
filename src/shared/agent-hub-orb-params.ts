import { z } from 'zod'
import { isStructuredAgentId } from './agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'

export const AgentHubOrbReleaseOperationParamsSchema = z.object({ operationId: z.string().uuid() })

export const AgentHubOrbOpenParamsSchema = z
  .object({
    resume: z.object({ sessionId: z.string().min(1).max(512) }).optional(),
    agent: z.string().refine(isStructuredAgentId).optional(),
    model: z.string().trim().min(1).max(512).nullable().optional(),
    cwd: z.string().trim().min(1).max(32_768).optional()
  })
  .default({})
export const AgentHubOrbListParamsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional()
  })
  .default({})

export const AgentHubOrbSessionSchema = z.object({
  sessionId: z.string(),
  tabId: z.string().optional(),
  resumed: z.boolean(),
  workspaceId: z.string().optional()
})
export const AgentHubOrbConversationSchema = z.object({
  sessionId: z.string(),
  agent: z.string().refine(isStructuredAgentId),
  model: z.string().optional(),
  title: z.string(),
  startedAt: z.number(),
  lastActiveAt: z.number(),
  lastReply: z.string().optional()
})
