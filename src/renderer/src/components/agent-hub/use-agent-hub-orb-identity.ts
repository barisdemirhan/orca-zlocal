import { useAppStore } from '@/store'
import {
  normalizeAgentHubOrbName,
  normalizeAgentHubOrbTint,
  type AgentHubOrbTint
} from '../../../../shared/agent-hub-orb-identity'

export function useAgentHubOrbName(): string {
  return useAppStore((state) => normalizeAgentHubOrbName(state.settings?.agentHubOrbName))
}

export function useAgentHubOrbTint(): AgentHubOrbTint {
  return useAppStore((state) => normalizeAgentHubOrbTint(state.settings?.agentHubOrbTint))
}

export function readAgentHubOrbName(): string {
  return normalizeAgentHubOrbName(useAppStore.getState().settings?.agentHubOrbName)
}
