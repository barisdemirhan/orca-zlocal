import { create } from 'zustand'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export const useAgentHubPaneSleepConfirmation = create<{
  target: AgentHubPaneTarget | null
  origin: HTMLElement | null
  request: (target: AgentHubPaneTarget, origin?: HTMLElement | null) => void
  dismiss: () => void
}>((set) => ({
  target: null,
  origin: null,
  request: (target, origin = null) => set({ target, origin }),
  dismiss: () => set({ target: null, origin: null })
}))
