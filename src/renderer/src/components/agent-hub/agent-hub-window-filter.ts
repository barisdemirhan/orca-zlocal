import { isAgentHubTargetSleeping, useAgentHubSleepingTargetTest } from './agent-hub-pane-sleep'
import { useMemo, useSyncExternalStore } from 'react'
import { translate } from '@/i18n/i18n'
import { agentHubMirrorSourceKey, type AgentHubMirrorState } from './agent-hub-mirror-membership'
import {
  readAgentHubMirrors,
  subscribeAgentHubMirrors,
  type AgentHubMirrorPresence
} from './agent-hub-mirror-store'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'

/** Which terminals the Agents and All terminals lists show, by where their mirror stands. */
export type AgentHubWindowFilter = 'any' | 'open' | 'minimized' | 'none' | 'sleeping'

type AgentHubWindowFilterOption = {
  id: AgentHubWindowFilter
  /** The mirror presence a row needs; 'any' lets every row through. */
  presence: AgentHubMirrorPresence | 'any'
  label: () => string
  emptyLabel: () => string | undefined
}

const ANY_WINDOW: AgentHubWindowFilterOption = {
  id: 'any',
  presence: 'any',
  label: () => translate('agentHub.windowFilter.any', 'All'),
  emptyLabel: () => undefined
}

export const AGENT_HUB_WINDOW_FILTERS: readonly AgentHubWindowFilterOption[] = [
  ANY_WINDOW,
  {
    id: 'sleeping',
    presence: 'any',
    label: () => translate('agentHub.sleep.group', 'Sleeping'),
    emptyLabel: () => translate('agentHub.sleep.empty', 'No sleeping terminals')
  },
  {
    id: 'open',
    presence: 'window',
    label: () => translate('agentHub.windowFilter.open', 'Open in a window'),
    emptyLabel: () =>
      translate('agentHub.windowFilter.emptyOpen', 'No terminal is open in a window')
  },
  {
    id: 'minimized',
    presence: 'chip',
    label: () => translate('agentHub.windowFilter.minimized', 'Minimized'),
    emptyLabel: () => translate('agentHub.windowFilter.emptyMinimized', 'No terminal is minimized')
  },
  {
    id: 'none',
    presence: null,
    label: () => translate('agentHub.windowFilter.none', 'Not in a window'),
    emptyLabel: () => translate('agentHub.windowFilter.emptyNone', 'Every terminal is in a window')
  }
]

export function agentHubWindowFilterOption(
  filter: AgentHubWindowFilter
): AgentHubWindowFilterOption {
  return AGENT_HUB_WINDOW_FILTERS.find((option) => option.id === filter) ?? ANY_WINDOW
}

/** The row test for a filter; undefined when it lets every row through. */
export function agentHubWindowFilterRowTest(
  filter: AgentHubWindowFilter,
  mirrors: AgentHubMirrorState,
  isSleeping: (target: AgentHubPaneTarget) => boolean = isAgentHubTargetSleeping
): ((row: AgentHubTerminalRow) => boolean) | undefined {
  if (filter === 'sleeping') {
    return (row) => isSleeping(paneTargetFromTerminalRow(row))
  }
  const { presence } = agentHubWindowFilterOption(filter)
  if (presence === 'any') {
    return undefined
  }
  const places = new Map<string, AgentHubMirrorPresence>()
  for (const window of mirrors.windows) {
    for (const tab of window.tabs) {
      places.set(agentHubMirrorSourceKey(tab.target), 'window')
    }
  }
  for (const chip of mirrors.chips) {
    for (const tab of chip.window.tabs) {
      places.set(agentHubMirrorSourceKey(tab.target), 'chip')
    }
  }
  return (row) =>
    (places.get(agentHubMirrorSourceKey(paneTargetFromTerminalRow(row))) ?? null) === presence
}

/** The filter's row test, following mirror changes only while a filter is set. */
export function useAgentHubWindowFilterRowTest(
  filter: AgentHubWindowFilter
): ((row: AgentHubTerminalRow) => boolean) | undefined {
  const isSleeping = useAgentHubSleepingTargetTest()
  const mirrors = useSyncExternalStore(subscribeAgentHubMirrors, () =>
    filter === 'any' || filter === 'sleeping' ? null : readAgentHubMirrors()
  )
  return useMemo(
    () =>
      filter === 'sleeping'
        ? (row: AgentHubTerminalRow) => isSleeping(paneTargetFromTerminalRow(row))
        : mirrors
          ? agentHubWindowFilterRowTest(filter, mirrors)
          : undefined,
    [filter, mirrors, isSleeping]
  )
}
