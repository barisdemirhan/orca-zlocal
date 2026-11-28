import { useSyncExternalStore } from 'react'
import type { Bot } from '../../../../shared/bot-types'
import type { AgentHubInboxSort } from './agent-hub-inbox-groups'
import type { AgentHubStateFilter } from './agent-hub-state-filter'
import type { AgentHubWindowFilter } from './agent-hub-window-filter'

export type AgentHubInboxSideChoice = 'both' | 'bots' | 'agents'

export type AgentHubPanelListState = {
  side: AgentHubInboxSideChoice
  /** Boxes folded shut; a box is its side's name. */
  foldedBoxes: ReadonlySet<string>
  /** A sender row opened or closed by hand; absent follows the selection. */
  openGroups: ReadonlyMap<string, boolean>
  /** The ask each sender has open; absent means its oldest. */
  activeAsks: ReadonlyMap<string, string>
  /** Session-only Inbox sorting: the senders' order and the asks' order within a sender. */
  sortOrder: AgentHubInboxSort
  sortWithin: AgentHubInboxSort
  query: string
  windowFilter: AgentHubWindowFilter
  collapseOverrides: ReadonlyMap<string, boolean>
  /** Workspaces whose folded idle agents were opened by hand (workspace keys). */
  idleFoldOpen: ReadonlySet<string>
  /** Hub-local Host sort: workspaces ordered by host, on top of the chosen sort. */
  sortByHost: boolean
  /** The state chip under the search; session-kept. */
  stateFilter: AgentHubStateFilter
  unreadOnly: boolean
  botStartedOnly: boolean
  /** Bots opened in the Bots tab, by host and bot (botRefKey). */
  botsExpanded: ReadonlySet<string>
  botsQuery: string
  /** Lists a bot's Show more opened, by botRefKey plus the list (chats, automations, or a chat's workers). */
  botsShowMore: ReadonlySet<string>
  /** A bot page the Bots tab opens on its next mount ("Open bot page" in the Inbox). */
  pendingBotPage: Bot | null
}

const INITIAL: AgentHubPanelListState = {
  side: 'both',
  foldedBoxes: new Set(),
  openGroups: new Map(),
  activeAsks: new Map(),
  sortOrder: 'longest',
  sortWithin: 'longest',
  query: '',
  windowFilter: 'any',
  collapseOverrides: new Map(),
  idleFoldOpen: new Set(),
  sortByHost: false,
  stateFilter: 'all',
  unreadOnly: false,
  botStartedOnly: false,
  botsExpanded: new Set(),
  botsQuery: '',
  botsShowMore: new Set(),
  pendingBotPage: null
}

// Module-level on purpose: folds, the side choice, filter and search outlive the panel's popover.
let state = INITIAL
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readAgentHubPanelListState(): AgentHubPanelListState {
  return state
}

export function updateAgentHubPanelListState(patch: Partial<AgentHubPanelListState>): void {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

export function resetAgentHubPanelListState(): void {
  if (state !== INITIAL) {
    state = INITIAL
    listeners.forEach((listener) => listener())
  }
}

export function useAgentHubPanelListState(): AgentHubPanelListState {
  return useSyncExternalStore(subscribe, readAgentHubPanelListState, readAgentHubPanelListState)
}

export function nextAgentHubSideChoice(
  current: AgentHubInboxSideChoice,
  botsActive: boolean
): AgentHubInboxSideChoice {
  const order: AgentHubInboxSideChoice[] = botsActive ? ['bots', 'agents', 'both'] : ['both']
  return order[(order.indexOf(current) + 1) % order.length] ?? 'both'
}

/** Pressing a badge shows its side alone; pressing the shown side again shows both. */
export function pressAgentHubSide(
  current: AgentHubInboxSideChoice,
  pressed: 'bots' | 'agents'
): AgentHubInboxSideChoice {
  return current === pressed ? 'both' : pressed
}
