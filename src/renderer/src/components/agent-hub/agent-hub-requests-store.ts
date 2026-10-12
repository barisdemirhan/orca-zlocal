import { useSyncExternalStore } from 'react'
import type {
  AgentHubDelivery,
  AgentHubAnswer,
  AgentHubClosed,
  AgentHubProgress,
  AgentHubRequest
} from '../../../../shared/agent-hub-requests'

export type AgentHubRequestHost = string
export type AgentHubInboxRequest = {
  host: string
  request: Extract<AgentHubRequest, { kind: 'ask' | 'consent' | 'notify' }>
}
export type AgentHubAwayAnswer = AgentHubClosed & { result: AgentHubAnswer }
export type AgentHubRequestAnswerState = {
  phase: 'sending' | 'answered-elsewhere' | 'error'
  message?: string
}
/** Each host owns its request IDs and pane keys; equal IDs on other hosts stay independent. */
export type AgentHubHostRequests = {
  pendingAsks: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'ask' }>>
  pendingConsents: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'consent' }>>
  notifications: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'notify' }>>
  progressByPane: ReadonlyMap<string, AgentHubProgress>
  awayAnswers: ReadonlyMap<string, AgentHubAwayAnswer>
  answerStates: ReadonlyMap<string, AgentHubRequestAnswerState>
}
export type AgentHubRequestsState = ReadonlyMap<AgentHubRequestHost, AgentHubHostRequests>

function emptyHost(): AgentHubHostRequests {
  return {
    pendingAsks: new Map(),
    pendingConsents: new Map(),
    notifications: new Map(),
    progressByPane: new Map(),
    awayAnswers: new Map(),
    answerStates: new Map()
  }
}

export function reduceAgentHubRequests(
  state: AgentHubRequestsState,
  host: AgentHubRequestHost,
  event: AgentHubDelivery
): AgentHubRequestsState {
  if (event.kind === 'snapshot') {
    let next: AgentHubRequestsState = new Map(state).set(host, {
      ...emptyHost(),
      awayAnswers: state.get(host)?.awayAnswers ?? new Map()
    })
    for (const item of [...event.snapshot.requests, ...event.snapshot.progress]) {
      next = reduceAgentHubRequests(next, host, item)
    }
    const view = next.get(host)
    if (view) {
      next = new Map(next).set(host, {
        ...view,
        answerStates: new Map(
          [...(state.get(host)?.answerStates ?? [])].filter(
            ([id]) =>
              view.pendingAsks.has(id) || view.pendingConsents.has(id) || view.notifications.has(id)
          )
        )
      })
    }
    return next
  }
  const previous = state.get(host) ?? emptyHost()
  const pendingAsks = new Map(previous.pendingAsks)
  const pendingConsents = new Map(previous.pendingConsents)
  const notifications = new Map(previous.notifications)
  const progressByPane = new Map(previous.progressByPane)
  const awayAnswers = new Map(previous.awayAnswers)
  const answerStates = new Map(previous.answerStates)
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
      answerStates.delete(event.requestId)
      if (event.result?.by === 'away-default') {
        awayAnswers.set(event.requestId, { ...event, result: event.result })
        const oldest = awayAnswers.keys().next()
        if (awayAnswers.size > 100 && !oldest.done) {
          awayAnswers.delete(oldest.value)
        }
      }
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
  return new Map(state).set(host, {
    pendingAsks,
    pendingConsents,
    notifications,
    progressByPane,
    awayAnswers,
    answerStates
  })
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

export function agentHubRequestKey(host: string, requestId: string): string {
  return `hub-request:${JSON.stringify([host, requestId])}`
}

export function agentHubInboxRequests(state: AgentHubRequestsState): AgentHubInboxRequest[] {
  return [...state]
    .flatMap(([host, view]) =>
      [
        ...view.pendingAsks.values(),
        ...view.pendingConsents.values(),
        ...view.notifications.values()
      ]
        .filter((request) => request.kind !== 'notify' || request.level === 'needs-you')
        .map((request) => ({ host, request }))
    )
    .sort((a, b) => a.request.createdAt - b.request.createdAt)
}

export function agentHubAwayAnswerCount(state: AgentHubRequestsState): number {
  return [...state.values()].reduce((total, view) => total + view.awayAnswers.size, 0)
}

export function setAgentHubRequestAnswerState(
  host: string,
  requestId: string,
  answer: AgentHubRequestAnswerState
): boolean {
  const view = state.get(host)
  if (
    !view ||
    !(
      view.pendingAsks.has(requestId) ||
      view.pendingConsents.has(requestId) ||
      view.notifications.has(requestId)
    )
  ) {
    return false
  }
  commit(
    new Map(state).set(host, {
      ...view,
      answerStates: new Map(view.answerStates).set(requestId, answer)
    })
  )
  return true
}

export function removeAgentHubResolvedRequest(
  host: string,
  requestId: string,
  answer: AgentHubRequestAnswerState
): void {
  if (state.get(host)?.answerStates.get(requestId) !== answer) {
    return
  }
  const request =
    state.get(host)?.pendingAsks.get(requestId) ??
    state.get(host)?.pendingConsents.get(requestId) ??
    state.get(host)?.notifications.get(requestId)
  if (request) {
    applyAgentHubDelivery(host, { ...request, kind: 'closed', reason: 'already_resolved' })
  }
}

export function dismissAgentHubAwayAnswer(host: string, requestId: string): void {
  const view = state.get(host)
  if (!view?.awayAnswers.has(requestId)) {
    return
  }
  const awayAnswers = new Map(view.awayAnswers)
  awayAnswers.delete(requestId)
  commit(new Map(state).set(host, { ...view, awayAnswers }))
}
