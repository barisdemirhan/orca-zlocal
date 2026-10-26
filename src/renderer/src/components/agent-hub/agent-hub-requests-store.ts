import { useSyncExternalStore } from 'react'
import type { AgentHubOrbOperation } from '../../../../shared/agent-hub-orb-operation'
import type {
  AgentHubDelivery,
  AgentHubAnswer,
  AgentHubClosed,
  AgentHubProgress,
  AgentHubRequest
} from '../../../../shared/agent-hub-requests'
import {
  projectAgentHubOrbClosedReceipt,
  pruneAgentHubOrbReceiptForRequest,
  type AgentHubOrbRequestReceipts
} from './agent-hub-orb-request-receipts'

export type AgentHubRequestHost = string
export type AgentHubInboxRequest = {
  host: string
  request: Extract<AgentHubRequest, { kind: 'ask' | 'gate' | 'consent' | 'notify' }>
}
export type AgentHubAwayAnswer = AgentHubClosed & { result: AgentHubAnswer }
export type AgentHubRequestAnswerState = {
  phase: 'sending' | 'answered-elsewhere' | 'error'
  message?: string
}
/** Each host owns its request IDs and pane keys; equal IDs on other hosts stay independent. */
export type AgentHubHostRequests = {
  orbOperations: ReadonlyMap<string, AgentHubOrbOperation>
  pendingGates: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'gate' }>>
  pendingAsks: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'ask' }>>
  pendingConsents: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'consent' }>>
  /** Shown only in the Orb conversation; never part of the inbox, dock counts or alerts. */
  pendingMemories: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'memory' }>>
  notifications: ReadonlyMap<string, Extract<AgentHubRequest, { kind: 'notify' }>>
  progressByPane: ReadonlyMap<string, AgentHubProgress>
  awayAnswers: ReadonlyMap<string, AgentHubAwayAnswer>
  answerStates: ReadonlyMap<string, AgentHubRequestAnswerState>
  orbReceipts: AgentHubOrbRequestReceipts
}
export type AgentHubRequestsState = ReadonlyMap<AgentHubRequestHost, AgentHubHostRequests>

function emptyHost(): AgentHubHostRequests {
  return {
    orbOperations: new Map(),
    pendingGates: new Map(),
    pendingAsks: new Map(),
    pendingConsents: new Map(),
    pendingMemories: new Map(),
    notifications: new Map(),
    progressByPane: new Map(),
    awayAnswers: new Map(),
    answerStates: new Map(),
    orbReceipts: new Map()
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
      awayAnswers: state.get(host)?.awayAnswers ?? new Map(),
      orbReceipts: state.get(host)?.orbReceipts ?? new Map()
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
              view.pendingGates.has(id) ||
              view.pendingAsks.has(id) ||
              view.pendingConsents.has(id) ||
              view.pendingMemories.has(id) ||
              view.notifications.has(id)
          )
        )
      })
    }
    return next
  }
  const previous = state.get(host) ?? emptyHost()
  if (event.kind === 'progress' && event.orbOperation) {
    const orbOperations = new Map(previous.orbOperations)
    if (event.orbOperation.active) {
      orbOperations.set(event.orbOperation.id, event.orbOperation)
    } else {
      orbOperations.delete(event.orbOperation.id)
    }
    return new Map(state).set(host, { ...previous, orbOperations })
  }
  const pendingGates = new Map(previous.pendingGates)
  const pendingAsks = new Map(previous.pendingAsks)
  const pendingConsents = new Map(previous.pendingConsents)
  const pendingMemories = new Map(previous.pendingMemories)
  const notifications = new Map(previous.notifications)
  const progressByPane = new Map(previous.progressByPane)
  const awayAnswers = new Map(previous.awayAnswers)
  const answerStates = new Map(previous.answerStates)
  let orbReceipts = previous.orbReceipts
  switch (event.kind) {
    case 'gate':
      orbReceipts = pruneAgentHubOrbReceiptForRequest(orbReceipts, event)
      pendingGates.set(event.requestId, event)
      break
    case 'ask':
      orbReceipts = pruneAgentHubOrbReceiptForRequest(orbReceipts, event)
      pendingAsks.set(event.requestId, event)
      break
    case 'consent':
      orbReceipts = pruneAgentHubOrbReceiptForRequest(orbReceipts, event)
      pendingConsents.set(event.requestId, event)
      break
    case 'memory':
      pendingMemories.set(event.requestId, event)
      break
    case 'notify':
      orbReceipts = pruneAgentHubOrbReceiptForRequest(orbReceipts, event)
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
      orbReceipts = projectAgentHubOrbClosedReceipt(
        orbReceipts,
        pendingGates.get(event.requestId) ??
          pendingAsks.get(event.requestId) ??
          pendingConsents.get(event.requestId) ??
          notifications.get(event.requestId),
        event
      )
      pendingGates.delete(event.requestId)
      pendingAsks.delete(event.requestId)
      pendingConsents.delete(event.requestId)
      pendingMemories.delete(event.requestId)
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
    case 'peek-control':
    case 'status':
    case 'presence':
      return state
  }
  return new Map(state).set(host, {
    orbOperations: previous.orbOperations,
    pendingGates,
    pendingAsks,
    pendingConsents,
    pendingMemories,
    notifications,
    progressByPane,
    awayAnswers,
    answerStates,
    orbReceipts
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
        ...view.pendingGates.values(),
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
      view.pendingGates.has(requestId) ||
      view.pendingAsks.has(requestId) ||
      view.pendingConsents.has(requestId) ||
      view.pendingMemories.has(requestId) ||
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
    state.get(host)?.pendingGates.get(requestId) ??
    state.get(host)?.pendingAsks.get(requestId) ??
    state.get(host)?.pendingConsents.get(requestId) ??
    state.get(host)?.pendingMemories.get(requestId) ??
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

export function dismissAgentHubOrbRequestReceipt(
  host: string,
  sessionId: string,
  requestId: string
): void {
  const view = state.get(host)
  if (view?.orbReceipts.get(sessionId)?.requestId !== requestId) {
    return
  }
  const orbReceipts = new Map(view.orbReceipts)
  orbReceipts.delete(sessionId)
  commit(new Map(state).set(host, { ...view, orbReceipts }))
}

/** The Orb's own pending memory proposals, oldest first. */
export function agentHubOrbMemoryRequests(
  state: AgentHubRequestsState,
  owner: { host: string; sessionId: string }
): Extract<AgentHubRequest, { kind: 'memory' }>[] {
  return [...(state.get(owner.host)?.pendingMemories.values() ?? [])]
    .filter(
      (request) => request.caller.kind === 'orb' && request.caller.sessionId === owner.sessionId
    )
    .sort((a, b) => a.createdAt - b.createdAt)
}
