import { useAppStore } from '@/store'
import {
  isAgentChatPermissionMode,
  type AgentChatPermissionMode
} from '../../../../shared/agent-chat-permission-mode'
import { agentHubOrbChosenMode } from '../../../../shared/agent-hub-orb-settings'
import { useStructuredAgentSessionStatusSummary } from '../native-chat/StructuredAgentSessionStatusBridge'

const LOCAL_TARGET = { kind: 'local' } as const

/** The mode the Orb chat runs in: the host's live word first, else the saved Orb choice. */
export function useAgentHubOrbPermissionMode(sessionId: string): AgentChatPermissionMode | null {
  const { summary } = useStructuredAgentSessionStatusSummary(sessionId, LOCAL_TARGET)
  const chosen = useAppStore((s) => s.settings?.agentHubOrbPermission)
  const live = summary?.permissionMode
  return isAgentChatPermissionMode(live) ? live : agentHubOrbChosenMode(chosen)
}
