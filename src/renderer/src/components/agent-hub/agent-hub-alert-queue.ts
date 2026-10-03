import { useSyncExternalStore } from 'react'
import type { AgentHubAlert } from './agent-hub-alerts'

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
  const panes = new Set(alerts.map((alert) => alert.thread.paneKey))
  emit(
    [...queue.filter((alert) => !panes.has(alert.thread.paneKey)), ...alerts].slice(
      -MAX_QUEUED_ALERTS
    )
  )
}

export function dismissAgentHubAlert(id: string): void {
  emit(queue.filter((alert) => alert.id !== id))
}

export function clearAgentHubAlerts(): void {
  if (queue.length > 0) {
    emit([])
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAgentHubAlertQueue(): readonly AgentHubAlert[] {
  return useSyncExternalStore(subscribe, () => queue)
}
