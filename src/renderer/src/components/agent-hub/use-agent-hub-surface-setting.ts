import { useAppStore } from '@/store'
import {
  agentHubSurfaceSetting,
  type AgentHubSurfaceSettings
} from '../../../../shared/agent-hub-surface-settings'

export function useAgentHubSurfaceSetting<K extends keyof AgentHubSurfaceSettings>(
  key: K
): Required<AgentHubSurfaceSettings>[K] {
  return useAppStore((s) => agentHubSurfaceSetting(s.settings, key))
}
