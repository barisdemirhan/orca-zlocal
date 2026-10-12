import { useSyncExternalStore } from 'react'
import { agentHubAlertPaneKey, type AgentHubAlert } from './agent-hub-alerts'
import { answerAgentHubRequest } from './agent-hub-request-answer'
import type { AgentHubRequestsState } from './agent-hub-requests-store'

// A burst (several agents finishing together) shows the newest few, not a backlog.
const MAX_QUEUED_ALERTS = 5

let queue: readonly AgentHubAlert[] = []
const listeners = new Set<() => void>()

function emit(next: readonly AgentHubAlert[]): void {
  queue = next
  for (const listener of listeners) {
    listener()
  }
}

/** Newer alerts for the same pane replace older ones; the oldest drop past the cap. */
export function pushAgentHubAlerts(alerts: readonly AgentHubAlert[]): void {
  const newestByPane = new Map<string, AgentHubAlert>()
  for (const alert of alerts) {
    const pane = agentHubAlertPaneKey(alert)
    newestByPane.delete(pane)
    newestByPane.set(pane, alert)
  }
  const fresh = [...newestByPane.values()]
  const panes = new Set(fresh.map(agentHubAlertPaneKey))
  emit(
    [...queue.filter((alert) => !panes.has(agentHubAlertPaneKey(alert))), ...fresh].slice(
      -MAX_QUEUED_ALERTS
    )
  )
}

/** A notice that closes on every desktop once its bubble goes; needs-you ones wait in the Inbox. */
function acknowledgesOnBubbleExit(alert: AgentHubAlert): boolean {
  return alert.request?.kind === 'notify' && alert.request.level !== 'needs-you'
}

export function dismissAgentHubAlert(id: string): void {
  const alert = queue.find((entry) => entry.id === id)
  if (alert && acknowledgesOnBubbleExit(alert) && alert.host !== undefined) {
    void answerAgentHubRequest(alert.host, alert.request.requestId, { kind: 'ack' })
    return
  }
  emit(queue.filter((alert) => alert.id !== id))
}

export function pruneAgentHubRequestAlerts(state: AgentHubRequestsState): void {
  const next = queue.filter((alert) => {
    if (!alert.request) {
      return true
    }
    const view = state.get(alert.host)
    return Boolean(
      view?.pendingGates.has(alert.request.requestId) ||
      view?.pendingAsks.has(alert.request.requestId) ||
      view?.pendingConsents.has(alert.request.requestId) ||
      view?.notifications.has(alert.request.requestId)
    )
  })
  if (next.length !== queue.length) {
    emit(next)
  }
}

export function clearAgentHubAlerts(): void {
  if (queue.length > 0) {
    for (const alert of queue) {
      if (acknowledgesOnBubbleExit(alert) && alert.host !== undefined && alert.request) {
        void answerAgentHubRequest(alert.host, alert.request.requestId, { kind: 'ack' })
      }
    }
    // Acknowledged notices stay queued until the host closes them; the rest leave the bubble stack.
    emit(queue.filter(acknowledgesOnBubbleExit))
  }
}

export function readAgentHubAlertQueue(): readonly AgentHubAlert[] {
  return queue
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAgentHubAlertQueue(): readonly AgentHubAlert[] {
  return useSyncExternalStore(subscribe, readAgentHubAlertQueue)
}
