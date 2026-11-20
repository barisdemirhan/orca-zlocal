import { create } from 'zustand'

type AnswerQueueState = { open: boolean; enabled: boolean; count: number }

export const useAgentHubAnswerQueueState = create<AnswerQueueState>(() => ({
  open: false,
  enabled: false,
  count: 0
}))

export function openAgentHubAnswerQueue(): void {
  const state = useAgentHubAnswerQueueState.getState()
  if (state.enabled) {
    useAgentHubAnswerQueueState.setState({ open: true })
  }
}

export function closeAgentHubAnswerQueue(): void {
  useAgentHubAnswerQueueState.setState({ open: false })
}

export function updateAgentHubAnswerQueuePresence(enabled: boolean, count: number): void {
  useAgentHubAnswerQueueState.setState((state) => ({
    enabled,
    count,
    open: enabled && state.open
  }))
}
