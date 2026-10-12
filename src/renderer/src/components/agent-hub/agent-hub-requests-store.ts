import { useSyncExternalStore } from 'react'
import type {
  AgentHubDelivery,
  AgentHubProgress,
  AgentHubRequest
} from '../../../../shared/agent-hub-requests'

export type AgentHubRequestHost = string
/** Each host owns its request IDs and pane keys; equal IDs on other hosts stay independent. */
export type AgentHubHostRequests = {
  pendingAsks: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'ask' }>>
  pendingConsents: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'consent' }>>
  notifications: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'notify' }>>
  progressByPane: ReadonlyMap<string, AgentHubProgress>
}
export type AgentHubRequestsState = ReadonlyMap<AgentHubRequestHost, AgentHubHostRequests>

function emptyHost(): AgentHubHostRequests {
  return {
    pendingAsks: new Map(),
    pendingConsents: new Map(),
    notifications: new Map(),
    progressByPane: new Map()
  }
}

export function reduceAgentHubRequests(
  state: AgentHubRequestsState,
  host: AgentHubRequestHost,
  event: AgentHubDelivery
): AgentHubRequestsState {
  if (event.kind === 'snapshot') {
    let next: AgentHubRequestsState = new Map(state).set(host, emptyHost())
    for (const item of [...event.snapshot.requests, ...event.snapshot.progress]) {
      next = reduceAgentHubRequests(next, host, item)
    }
    return next
  }
  const previous = state.get(host) ?? emptyHost()
  const pendingAsks = new Map(previous.pendingAsks)
  const pendingConsents = new Map(previous.pendingConsents)
  const notifications = new Map(previous.notifications)
  const progressByPane = new Map(previous.progressByPane)
  switch (event.kind) {
    case 'ask':
      pendingAsks.set(event.requestId, event)
      break
    case 'consent':
      pendingConsents.set(event.requestId, event)
      break
    case 'notify':
      notifications.set(event.requestId, event)
      break
    case 'progress':
      if (event.text === null) {
        progressByPane.delete(event.target.paneKey)
      } else {
        progressByPane.set(event.target.paneKey, event)
      }
      break
    case 'closed':
      pendingAsks.delete(event.requestId)
      pendingConsents.delete(event.requestId)
      notifications.delete(event.requestId)
      for (const [pane, progress] of progressByPane) {
        if (progress.requestId === event.requestId) {
          progressByPane.delete(pane)
        }
      }
      break
    // Acted on by the executor and never kept: nothing to store.
    case 'mirror':
    case 'arrange':
    case 'canvas':
    case 'peek':
    case 'status':
    case 'presence':
      return state
  }
  return new Map(state).set(host, { pendingAsks, pendingConsents, notifications, progressByPane })
}

let state: AgentHubRequestsState = new Map()
const listeners = new Set<() => void>()
function commit(next: AgentHubRequestsState): void {
  state = next
  listeners.forEach((listener) => listener())
}
export function applyAgentHubDelivery(host: AgentHubRequestHost, event: AgentHubDelivery): void {
  commit(reduceAgentHubRequests(state, host, event))
}
export function clearAgentHubRequestHost(host: AgentHubRequestHost): void {
  const next = new Map(state)
  next.delete(host)
  commit(next)
}
export function readAgentHubRequests(): AgentHubRequestsState {
  return state
}
export function subscribeAgentHubRequests(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function useAgentHubRequests(): AgentHubRequestsState {
  return useSyncExternalStore(subscribeAgentHubRequests, readAgentHubRequests)
}
