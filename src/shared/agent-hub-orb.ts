import type { StructuredAgentId } from './agent-session-provider-handle'

export const AGENT_HUB_ORB_ORIGIN = 'agent-hub-orb' as const
export const AGENT_HUB_ORB_OPENING_PROMPT =
  "You are Orca's Orb, the central conversation in Agent Hub. Manage Orca through the `orca` CLI. " +
  'Run `orca skills get orca-cli` first, and `orca skills get orchestration` when managing workers. ' +
  'Report briefly. For questions to the user, use `orca hub ask`.'

export type AgentHubOrbOpenParams = {
  resume?: { sessionId: string }
  agent?: StructuredAgentId
  model?: string | null
  cwd?: string
}
export type AgentHubOrbSession = { sessionId: string; tabId?: string; resumed: boolean }
export type AgentHubOrbConversation = {
  sessionId: string
  agent: StructuredAgentId
  model?: string
  title: string
  startedAt: number
  lastActiveAt: number
  lastReply?: string
}
export type AgentHubOrbApi = {
  open(params?: AgentHubOrbOpenParams): Promise<AgentHubOrbSession>
  current(): Promise<AgentHubOrbSession | null>
  list(params?: { limit?: number }): Promise<AgentHubOrbConversation[]>
}
