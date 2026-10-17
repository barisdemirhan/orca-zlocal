import { create } from 'zustand'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import { returnRetainedPaneDestinationHome } from '../tab-group/retained-pane-destinations'
import { AGENT_HUB_ORB_DEFAULT_DIAMETER } from './agent-hub-orb-geometry'

type OrbPanelState = {
  session: AgentHubOrbSession | null
  opening: boolean
  closeGeneration: number
  destination: HTMLElement | null
  chatVisible: boolean
  presentation: 'chat' | 'orb'
  compact: boolean
  preferredDiameter: number
  stagePosition: { x: number; y: number } | null
  requestDestination: HTMLElement | null
  nativeRequestPending: boolean
  nativeRequestVisible: boolean
}

export const useAgentHubOrbPanel = create<OrbPanelState>(() => ({
  session: null,
  opening: false,
  closeGeneration: 0,
  destination: null,
  chatVisible: true,
  presentation: 'orb',
  compact: false,
  preferredDiameter: AGENT_HUB_ORB_DEFAULT_DIAMETER,
  stagePosition: null,
  requestDestination: null,
  nativeRequestPending: false,
  nativeRequestVisible: false
}))

export function showAgentHubOrbPanel(session: AgentHubOrbSession): void {
  const previous = useAgentHubOrbPanel.getState().session
  useAgentHubOrbPanel.setState({
    session,
    chatVisible: true,
    ...(previous?.sessionId !== session.sessionId || previous?.tabId !== session.tabId
      ? {
          presentation: 'orb',
          compact: false,
          nativeRequestPending: false,
          nativeRequestVisible: false
        }
      : {})
  })
}

export function closeAgentHubOrbPanel(): void {
  setAgentHubOrbDestination(null)
  setAgentHubOrbRequestDestination(null)
  useAgentHubOrbPanel.setState({
    session: null,
    closeGeneration: useAgentHubOrbPanel.getState().closeGeneration + 1,
    chatVisible: true,
    compact: false,
    requestDestination: null,
    nativeRequestPending: false,
    nativeRequestVisible: false
  })
}

export function setAgentHubOrbRequestDestination(requestDestination: HTMLElement | null): void {
  const previous = useAgentHubOrbPanel.getState().requestDestination
  if (previous === requestDestination) {
    return
  }
  if (previous) {
    returnRetainedPaneDestinationHome(previous)
  }
  useAgentHubOrbPanel.setState({ requestDestination })
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
