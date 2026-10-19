import { create } from 'zustand'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import type { AgentHubOrbAction } from '../../../../shared/agent-hub-settings'
import { returnRetainedPaneDestinationHome } from '../tab-group/retained-pane-destinations'
import { AGENT_HUB_ORB_DEFAULT_DIAMETER } from './agent-hub-orb-geometry'

export type AgentHubOrbLaunchRequest = {
  id: number
  action: AgentHubOrbAction
  sessionId: string
  tabId: string
  closeGeneration: number
}

type OrbPanelState = {
  session: AgentHubOrbSession | null
  opening: boolean
  closeGeneration: number
  launchSequence: number
  launchRequest: AgentHubOrbLaunchRequest | null
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
  launchSequence: 0,
  launchRequest: null,
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

export function showAgentHubOrbPanel(
  session: AgentHubOrbSession,
  action?: AgentHubOrbAction
): void {
  const state = useAgentHubOrbPanel.getState()
  const previous = state.session
  const launchSequence = state.launchSequence + 1
  useAgentHubOrbPanel.setState({
    session,
    launchSequence,
    launchRequest:
      action && session.tabId
        ? {
            id: launchSequence,
            action,
            sessionId: session.sessionId,
            tabId: session.tabId,
            closeGeneration: state.closeGeneration
          }
        : null,
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
    launchRequest: null,
    closeGeneration: useAgentHubOrbPanel.getState().closeGeneration + 1,
    chatVisible: true,
    compact: false,
    requestDestination: null,
    nativeRequestPending: false,
    nativeRequestVisible: false
  })
}

export function cancelAgentHubOrbLaunch(sessionId: string, tabId: string | undefined): void {
  const state = useAgentHubOrbPanel.getState()
  if (state.session?.sessionId !== sessionId || state.session.tabId !== tabId) {
    return
  }
  useAgentHubOrbPanel.setState({ launchRequest: null, launchSequence: state.launchSequence + 1 })
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
