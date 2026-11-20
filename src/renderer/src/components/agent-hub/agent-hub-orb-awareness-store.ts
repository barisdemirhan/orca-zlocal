import { create } from 'zustand'
import type { AgentHubOrbAwareness } from '../../../../shared/agent-hub-orb-awareness'
import type { AgentHubOrbNoticeDisplay } from './agent-hub-orb-notice-display'
import type { AgentHubOrbQuotaAlert } from './agent-hub-orb-quota-notices'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export const useAgentHubOrbAwarenessStore = create<{
  snapshot: AgentHubOrbAwareness | null
  targets: ReadonlyMap<string, AgentHubPaneTarget>
  display: ReadonlyMap<string, AgentHubOrbNoticeDisplay>
  quota: readonly AgentHubOrbQuotaAlert[]
  delivery: 'idle' | 'delivered' | 'unverifiable'
}>(() => ({ snapshot: null, targets: new Map(), display: new Map(), quota: [], delivery: 'idle' }))

export function orbAwarenessTarget(host: string, paneKey: string): AgentHubPaneTarget | undefined {
  return useAgentHubOrbAwarenessStore.getState().targets.get(JSON.stringify([host, paneKey]))
}
