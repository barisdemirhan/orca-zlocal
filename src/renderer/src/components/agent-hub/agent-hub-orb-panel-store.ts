import { create } from 'zustand'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import { returnRetainedPaneDestinationHome } from '../tab-group/retained-pane-destinations'

type OrbPanelState = {
  session: AgentHubOrbSession | null
  destination: HTMLElement | null
  chatVisible: boolean
}

export const useAgentHubOrbPanel = create<OrbPanelState>(() => ({
  session: null,
  destination: null,
  chatVisible: true
}))

export function showAgentHubOrbPanel(session: AgentHubOrbSession): void {
  useAgentHubOrbPanel.setState({ session, chatVisible: true })
}

export function closeAgentHubOrbPanel(): void {
  setAgentHubOrbDestination(null)
  useAgentHubOrbPanel.setState({ session: null, chatVisible: true })
}

export function setAgentHubOrbDestination(destination: HTMLElement | null): void {
  const previous = useAgentHubOrbPanel.getState().destination
  if (previous === destination) {
    return
  }
  if (previous) {
    returnRetainedPaneDestinationHome(previous)
  }
  useAgentHubOrbPanel.setState({ destination })
}
