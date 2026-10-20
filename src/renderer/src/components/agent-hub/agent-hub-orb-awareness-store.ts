import { create } from 'zustand'
import type { AgentHubOrbAwareness } from '../../../../shared/agent-hub-orb-awareness'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export const useAgentHubOrbAwarenessStore = create<{
  snapshot: AgentHubOrbAwareness | null
  targets: ReadonlyMap<string, AgentHubPaneTarget>
  delivery: 'idle' | 'delivered' | 'unverifiable'
}>(() => ({ snapshot: null, targets: new Map(), delivery: 'idle' }))

export function orbAwarenessTarget(host: string, paneKey: string): AgentHubPaneTarget | undefined {
  return useAgentHubOrbAwarenessStore.getState().targets.get(JSON.stringify([host, paneKey]))
}
