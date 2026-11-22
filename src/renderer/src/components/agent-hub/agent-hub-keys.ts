/** `agents` is every agent terminal, busy or idle; `all` adds plain shells; `bots` exists only while bots are on. */
export type AgentHubTab = 'inbox' | 'running' | 'agents' | 'all' | 'bots'

export const AGENT_HUB_TABS: readonly AgentHubTab[] = ['inbox', 'running', 'agents', 'all']
const AGENT_HUB_TABS_WITH_BOTS: readonly AgentHubTab[] = [...AGENT_HUB_TABS, 'bots']

export function agentHubTabs(botsActive: boolean): readonly AgentHubTab[] {
  return botsActive ? AGENT_HUB_TABS_WITH_BOTS : AGENT_HUB_TABS
}

export type AgentHubKeyInput = {
  key: string
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

export type AgentHubKeyContext = {
  tab: AgentHubTab
  /** Focus is in a text field (the search box, or a card's free-text answer). */
  inTextField: boolean
  inSearch: boolean
  /** Focus is on a button, whose own Enter must not also open a row. */
  onButton: boolean
  /** The inbox is showing a waiting agent's card. */
  hasCard: boolean
}

export type AgentHubKeyAction =
  | { type: 'switchTab'; direction: 1 | -1 }
  | { type: 'moveSelection'; delta: 1 | -1 }
  | { type: 'pageCard'; delta: 1 | -1 }
  | { type: 'open'; popout: boolean }
  | { type: 'answer'; optionIndex: number }

/** The popover's own keys; app chords (⌘/Ctrl) are left to the global handler. */
export function resolveAgentHubKeyAction(
  input: AgentHubKeyInput,
  context: AgentHubKeyContext
): AgentHubKeyAction | null {
  if (input.metaKey || input.ctrlKey) {
    return null
  }
  // The search box keeps list navigation; a card's answer field keeps its own keys.
  const listKeysAllowed = !context.inTextField || context.inSearch
  switch (input.key) {
    case 'Tab':
      return listKeysAllowed ? { type: 'switchTab', direction: input.shiftKey ? -1 : 1 } : null
    case 'ArrowDown':
    case 'ArrowUp':
      return listKeysAllowed
        ? { type: 'moveSelection', delta: input.key === 'ArrowDown' ? 1 : -1 }
        : null
    case 'ArrowLeft':
    case 'ArrowRight':
      return !context.inTextField && context.tab === 'inbox' && context.hasCard
        ? { type: 'pageCard', delta: input.key === 'ArrowRight' ? 1 : -1 }
        : null
    case 'Enter':
      return listKeysAllowed && !context.onButton ? { type: 'open', popout: input.altKey } : null
    default:
      break
  }
  if (
    /^[1-9]$/.test(input.key) &&
    !input.altKey &&
    !context.inTextField &&
    context.tab === 'inbox' &&
    context.hasCard
  ) {
    return { type: 'answer', optionIndex: Number(input.key) - 1 }
  }
  return null
}

export function nextAgentHubTab(
  tab: AgentHubTab,
  direction: 1 | -1,
  tabs: readonly AgentHubTab[] = AGENT_HUB_TABS
): AgentHubTab {
  const index = tabs.indexOf(tab)
  const count = tabs.length
  return tabs[(index + direction + count) % count] ?? 'inbox'
}

/** Arrow-key selection over `count` rows; -1 means nothing is selected. */
export function moveAgentHubSelection(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) {
    return -1
  }
  if (current < 0) {
    return delta > 0 ? 0 : count - 1
  }
  return Math.max(-1, Math.min(count - 1, current + delta))
}
