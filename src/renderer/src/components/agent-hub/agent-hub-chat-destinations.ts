import { create } from 'zustand'

type AgentHubChatDestination = {
  tabId: string
  /** The mirror's slot the chat's retained view moves into. */
  element: HTMLElement
  visible: boolean
  focused: boolean
}

const useDestinations = create<{ byTabId: ReadonlyMap<string, AgentHubChatDestination> }>(() => ({
  byTabId: new Map()
}))

export function setAgentHubChatDestinations(entries: readonly AgentHubChatDestination[]): void {
  useDestinations.setState({ byTabId: new Map(entries.map((entry) => [entry.tabId, entry])) })
}

export function useAgentHubChatDestination(tabId: string): AgentHubChatDestination | null {
  return useDestinations((state) => state.byTabId.get(tabId) ?? null)
}
