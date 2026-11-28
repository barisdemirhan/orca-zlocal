import { useSyncExternalStore } from 'react'
import { agentHubAlertPaneKey, agentHubAlertRequest, type AgentHubAlert } from './agent-hub-alerts'
import { answerAgentHubRequest } from './agent-hub-request-answer'
import type { AgentHubRequestsState } from './agent-hub-requests-store'

// A burst (several agents finishing together) shows the newest few, not a backlog.
const MAX_QUEUED_ALERTS = 5
// Why more for bots: past five bubbles the rest fold into a chip, so the queue must still hold them.
const MAX_QUEUED_BOT_ALERTS = 12

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
  const merged = [...queue.filter((alert) => !panes.has(agentHubAlertPaneKey(alert))), ...fresh]
  const kept = new Set<AgentHubAlert>([
    ...merged.filter((alert) => alert.bot).slice(-MAX_QUEUED_BOT_ALERTS),
    ...merged.filter((alert) => !alert.bot).slice(-MAX_QUEUED_ALERTS)
  ])
  emit(merged.filter((alert) => kept.has(alert)))
}

/** A notice that closes on every desktop once its bubble goes; needs-you ones wait in the Inbox. */
function acknowledgesOnBubbleExit(alert: AgentHubAlert): boolean {
  const request = agentHubAlertRequest(alert)
  return request?.request.kind === 'notify' && request.request.level !== 'needs-you'
}

export function dismissAgentHubAlert(id: string): void {
  const alert = queue.find((entry) => entry.id === id)
  const request = alert ? agentHubAlertRequest(alert) : null
  if (alert && request && acknowledgesOnBubbleExit(alert)) {
    void answerAgentHubRequest(request.host, request.request.requestId, { kind: 'ack' })
    return
  }
  emit(queue.filter((alert) => alert.id !== id))
}

/** Drops a bot chat's question once the chat stops asking: those bubbles have no timer of their own. */
export function pruneAgentHubBotChatAsks(waiting: ReadonlySet<string>): void {
  const next = queue.filter(
    (alert) =>
      alert.kind !== 'ask' ||
      alert.bot?.subject.type !== 'thread' ||
      waiting.has(alert.bot.subject.alert.id)
  )
  if (next.length !== queue.length) {
    emit(next)
  }
}

export function pruneAgentHubRequestAlerts(state: AgentHubRequestsState): void {
  const next = queue.filter((alert) => {
    const pending = agentHubAlertRequest(alert)
    if (!pending) {
      return true
    }
    const view = state.get(pending.host)
    return Boolean(
      view?.pendingGates.has(pending.request.requestId) ||
      view?.pendingAsks.has(pending.request.requestId) ||
      view?.pendingConsents.has(pending.request.requestId) ||
      view?.notifications.has(pending.request.requestId)
    )
  })
  if (next.length !== queue.length) {
    emit(next)
  }
}

export function clearAgentHubAlerts(): void {
  if (queue.length > 0) {
    for (const alert of queue) {
      const request = agentHubAlertRequest(alert)
      if (request && acknowledgesOnBubbleExit(alert)) {
        void answerAgentHubRequest(request.host, request.request.requestId, { kind: 'ack' })
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
