import { useSyncExternalStore } from 'react'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { agentHubPromptText, agentHubStateSince } from './agent-hub-lists'

/** How long a reopened card keeps showing an answer still on its way, before it can be retried. */
export const AGENT_HUB_ANSWER_HOLD_MS = 10_000
const LIMIT = 64

/** Where a prompt's card can be closed without answering: the pane's card, the hub's Inbox. */
export type AgentHubCardSurface = 'pane' | 'inbox'

type PromptRecord = {
  /** The option sent (-1 for the user's own words); null when nothing was sent. */
  choice: number | null
  at: number
  dismissedIn: ReadonlySet<AgentHubCardSurface>
  pending?: boolean
  answerToken?: symbol
}

// Why module scope: the hub's cards unmount on paging and closing while their answer is still
// being typed, and a remounted card must not offer the same prompt a second time. The pane's
// card and the alert bubble answer the same prompt, so they share this record.
const records = new Map<string, PromptRecord>()
const listeners = new Set<() => void>()
let version = 0

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function write(key: string, record: PromptRecord): void {
  records.delete(key)
  records.set(key, record)
  if (records.size > LIMIT) {
    const oldest = records.keys().next().value
    if (oldest !== undefined) {
      records.delete(oldest)
    }
  }
  version += 1
  listeners.forEach((listener) => listener())
}

// FNV-1a, short: two different questions in one turn must not share a record.
function promptStamp(prompt: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < prompt.length; i++) {
    hash = Math.imul(hash ^ prompt.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * One key per prompt. Why the prompt itself: `stateStartedAt` stays pinned for a whole working
 * run, so an agent asking twice in one turn would otherwise share a record, and a card closed
 * for the first question would never show for the second.
 */
export function agentHubCardKey(
  paneKey: string,
  stateSince: number,
  prompt: string | null = null
): string {
  return prompt ? `${paneKey}:${stateSince}:${promptStamp(prompt)}` : `${paneKey}:${stateSince}`
}

export function agentHubThreadCardKey(thread: AgentPaneThread): string {
  return agentHubCardKey(thread.paneKey, agentHubStateSince(thread), agentHubPromptText(thread))
}

// Why pure: it serves as a store snapshot; an expired hold reads as null and is evicted later.
export function readAnsweredAgentHubCard(key: string, now = Date.now()): number | null {
  const entry = records.get(key)
  if (!entry || entry.choice === null || now - entry.at >= AGENT_HUB_ANSWER_HOLD_MS) {
    return null
  }
  return entry.choice
}

export function recordAgentHubCardAnswer(
  key: string,
  choice: number | null,
  pending = false
): (delivered: boolean) => boolean {
  const entry = records.get(key)
  const answerToken = Symbol()
  write(key, {
    choice,
    at: Date.now(),
    dismissedIn: entry?.dismissedIn ?? new Set(),
    pending,
    answerToken
  })
  let settled = false
  return (delivered) => {
    const current = records.get(key)
    if (settled || current?.answerToken !== answerToken) {
      return false
    }
    settled = true
    write(key, { ...current, choice: delivered ? choice : null, pending: false, at: Date.now() })
    return true
  }
}

export function dismissAgentHubCard(key: string, surface: AgentHubCardSurface): void {
  const entry = records.get(key)
  write(key, {
    ...entry,
    choice: entry?.choice ?? null,
    at: entry?.at ?? Date.now(),
    dismissedIn: new Set([...(entry?.dismissedIn ?? []), surface])
  })
}

/** Brings closed cards back on that surface, e.g. the Inbox's "show hidden". */
export function showAgentHubCardsAgain(
  keys: readonly string[],
  surface: AgentHubCardSurface
): void {
  for (const key of keys) {
    const entry = records.get(key)
    if (entry?.dismissedIn.has(surface)) {
      const dismissedIn = new Set(entry.dismissedIn)
      dismissedIn.delete(surface)
      write(key, { ...entry, dismissedIn })
    }
  }
}

export function isAgentHubCardDismissed(key: string, surface: AgentHubCardSurface): boolean {
  return records.get(key)?.dismissedIn.has(surface) === true
}

/** The waiting agents whose card is still open on that surface. */
export function withoutDismissedAgentHubCards(
  threads: readonly AgentPaneThread[],
  surface: AgentHubCardSurface
): AgentPaneThread[] {
  return threads.filter(
    (thread) => !isAgentHubCardDismissed(agentHubThreadCardKey(thread), surface)
  )
}

/** The answer on record for this prompt, from any surface, as it changes. */
export function useAnsweredAgentHubCard(key: string): number | null {
  return useSyncExternalStore(subscribe, () => readAnsweredAgentHubCard(key))
}

export function useAgentHubCardAnswerPending(key: string): boolean {
  return useSyncExternalStore(subscribe, () => records.get(key)?.pending === true)
}

export function useAgentHubCardDismissed(key: string, surface: AgentHubCardSurface): boolean {
  return useSyncExternalStore(subscribe, () => isAgentHubCardDismissed(key, surface))
}

/** Bumps on every record change, for lists that filter by these records. */
export function useAgentHubCardRecordVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function resetAgentHubAnsweredCardsForTest(): void {
  records.clear()
  version += 1
  listeners.forEach((listener) => listener())
}
