import type { AgentHubOrbAwareness } from '../../../../shared/agent-hub-orb-awareness'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'

/** True while an update notice that needs no answer is still unresolved in the Hub. */
export function agentHubOrbAttention(snapshot: AgentHubOrbAwareness | null): boolean {
  return snapshot?.notices.some((notice) => notice.kind === 'info') ?? false
}

export function useAgentHubOrbAttention(): boolean {
  return useAgentHubOrbAwarenessStore((s) => agentHubOrbAttention(s.snapshot))
}
