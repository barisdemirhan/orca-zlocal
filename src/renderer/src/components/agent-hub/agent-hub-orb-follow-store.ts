import { create } from 'zustand'
import type { AgentHubOrbFollowNotice } from './agent-hub-orb-quota-notices'

export const useAgentHubOrbFollowStore = create<{
  notices: readonly AgentHubOrbFollowNotice[]
  delivery: 'idle' | 'delivered' | 'unverifiable'
}>(() => ({ notices: [], delivery: 'idle' }))
