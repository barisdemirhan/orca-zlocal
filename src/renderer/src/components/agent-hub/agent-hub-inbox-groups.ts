import type { Bot } from '../../../../shared/bot-types'
import type { AgentHubInboxOrder } from '../../../../shared/agent-hub-surface-settings'

export type AgentHubInboxSide = 'bots' | 'agents'
export type AgentHubInboxEntryKind = 'ask' | 'fail' | 'result' | 'suggestion'

export type AgentHubInboxSource = 'item' | 'request' | 'chat'

export type AgentHubInboxEntry<T> = {
  /** The row's identity: selection, keys and drafts bind to it, never to an index. */
  id: string
  senderKey: string
  side: AgentHubInboxSide
  kind: AgentHubInboxEntryKind
  /** When it began waiting or finished; null when the ask has no time of its own. */
  since: number | null
  /** Where the entry was read from: the work record outranks the request, which outranks the chat. */
  source?: AgentHubInboxSource
  /** `id:` question event ids, `chat:` sessions and `text:` normalised words that name the question. */
  questionKeys?: string[]
  /** Where a bot's entry came from (home, automation, worker...). */
  origin?: string
  /** The bot a chat or worker entry belongs to, when its payload carries none. */
  bot?: Bot
  /** The agent whose own worker this is, as "@claude". */
  workerOf?: string
  /** Closed with Later or Hide card: still counts, shown only by "Show". */
  hidden?: boolean
  payload: T
}

export type AgentHubInboxGroup<T> = {
  key: string
  side: AgentHubInboxSide
  /** Oldest waiting first. */
  asks: AgentHubInboxEntry<T>[]
  /** Failed and interrupted work, newest first, ahead of the results. */
  fails: AgentHubInboxEntry<T>[]
  results: AgentHubInboxEntry<T>[]
  /** Folded into one row; they never count. */
  suggestions: AgentHubInboxEntry<T>[]
}

const SOURCE_RANK: Record<AgentHubInboxSource, number> = { item: 0, request: 1, chat: 2 }

function keysOf(entry: AgentHubInboxEntry<unknown>, prefix: string): string[] {
  return (entry.questionKeys ?? []).filter((key) => key.startsWith(prefix))
}

function sameQuestion(a: AgentHubInboxEntry<unknown>, b: AgentHubInboxEntry<unknown>): boolean {
  const shared = (prefix: string): boolean => {
    const other = keysOf(b, prefix)
    return keysOf(a, prefix).some((key) => other.includes(key))
  }
  if (shared('id:') || shared('text:')) {
    return true
  }
  // Why: one chat may ask twice; its session only joins two copies when one of them has no words to compare.
  const bothWords = keysOf(a, 'text:').length > 0 && keysOf(b, 'text:').length > 0
  return !bothWords && a.source !== b.source && shared('chat:')
}

/**
 * The same question reaching the Inbox twice (a bot's chat, its work record, a hub request) is one
 * row and one count: the work record wins and the earliest wait is kept.
 */
export function mergeAgentHubInboxDuplicates<E extends AgentHubInboxEntry<unknown>>(
  entries: readonly E[]
): E[] {
  const merged: E[] = []
  for (const entry of entries) {
    const at =
      entry.kind === 'ask'
        ? merged.findIndex(
            (kept) =>
              kept.kind === 'ask' &&
              kept.side === entry.side &&
              kept.senderKey === entry.senderKey &&
              sameQuestion(kept, entry)
          )
        : -1
    if (at < 0) {
      merged.push(entry)
      continue
    }
    const kept = merged[at]!
    const winner =
      SOURCE_RANK[entry.source ?? 'chat'] < SOURCE_RANK[kept.source ?? 'chat'] ? entry : kept
    const since =
      kept.since === null || entry.since === null
        ? (kept.since ?? entry.since)
        : Math.min(kept.since, entry.since)
    merged[at] = {
      ...winner,
      since,
      questionKeys: [...new Set([...(kept.questionKeys ?? []), ...(entry.questionKeys ?? [])])]
    }
  }
  return merged
}

function rank(group: AgentHubInboxGroup<unknown>): number {
  if (group.asks.length > 0) {
    return 0
  }
  if (group.fails.length > 0) {
    return 1
  }
  return group.results.length > 0 ? 2 : 3
}

export type AgentHubInboxSort = 'longest' | 'newest'
export type AgentHubInboxSortChoice = { order: AgentHubInboxSort; within: AgentHubInboxSort }

const ASK_TIME_UNKNOWN = Number.MAX_SAFE_INTEGER

function askTimes(group: AgentHubInboxGroup<unknown>): number[] {
  return group.asks.map((ask) => ask.since ?? ASK_TIME_UNKNOWN)
}

function leadTime(group: AgentHubInboxGroup<unknown>, sort: AgentHubInboxSort): number {
  if (group.asks.length > 0) {
    const times = askTimes(group)
    const known = times.filter((time) => time !== ASK_TIME_UNKNOWN)
    return sort === 'longest' ? Math.min(...times) : -Math.max(0, ...known)
  }
  return group.fails[0]?.since ?? -(group.results[0]?.since ?? 0)
}

/** Boxes by sender: askers, then failures, then results, then suggestion-only senders. */
export function buildAgentHubInboxGroups<T>(
  entries: readonly AgentHubInboxEntry<T>[],
  order: AgentHubInboxOrder,
  sort: AgentHubInboxSortChoice = { order: 'longest', within: 'longest' }
): { boxes: { side: AgentHubInboxSide; groups: AgentHubInboxGroup<T>[] }[] } {
  const bySender = new Map<string, AgentHubInboxGroup<T>>()
  for (const entry of mergeAgentHubInboxDuplicates(entries)) {
    const key = `${entry.side}:${entry.senderKey}`
    let group = bySender.get(key)
    if (!group) {
      group = { key, side: entry.side, asks: [], fails: [], results: [], suggestions: [] }
      bySender.set(key, group)
    }
    const list = {
      ask: group.asks,
      fail: group.fails,
      result: group.results,
      suggestion: group.suggestions
    }[entry.kind]
    list.push(entry)
  }
  const groups = [...bySender.values()]
  for (const group of groups) {
    // Why last: an ask with no time of its own has waited for nobody to measure.
    const sign = sort.within === 'longest' ? 1 : -1
    group.asks.sort((a, b) => {
      if (a.since === null || b.since === null) {
        return (a.since === null ? 1 : 0) - (b.since === null ? 1 : 0)
      }
      return sign * (a.since - b.since)
    })
    group.fails.sort((a, b) => (b.since ?? 0) - (a.since ?? 0))
    group.results.sort((a, b) => (b.since ?? 0) - (a.since ?? 0))
  }
  groups.sort((a, b) => rank(a) - rank(b) || leadTime(a, sort.order) - leadTime(b, sort.order))
  const sides: AgentHubInboxSide[] =
    order === 'bots-first' ? ['bots', 'agents'] : ['agents', 'bots']
  return {
    boxes: sides.map((side) => ({ side, groups: groups.filter((group) => group.side === side) }))
  }
}
