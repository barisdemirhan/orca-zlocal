/** Where the Agent Hub lives: a draggable dock on a window edge, or a status-bar item. */
export type AgentHubPlacement = 'dock' | 'status-bar'

export type AgentHubDockEdge = 'bottom' | 'top' | 'left' | 'right'

/** The dock's edge and its spot along that edge, 0 (start) to 1 (end). */
export type AgentHubDockPosition = { edge: AgentHubDockEdge; offset: number }

export type AgentHubDefaultTab = 'inbox' | 'running' | 'all'

export type AgentHubDockSize = 'small' | 'medium' | 'large'

/** Agent Hub's settings, kept out of global-settings-types.ts (at its line budget). */
export type AgentHubSettings = {
  /** Experimental: Agent Hub — every agent and terminal in one popover, with inline answers. */
  experimentalAgentHub?: boolean
  /** Agent Hub: a draggable dock on a window edge (default) or a status-bar item. */
  agentHubPlacement?: AgentHubPlacement
  /** Agent Hub dock: the window edge it sits on and its spot along that edge. */
  agentHubDockPosition?: AgentHubDockPosition
  /** Agent Hub dock: how large it is drawn. */
  agentHubDockSize?: AgentHubDockSize
  /** Agent Hub dock: stay out of sight while no agent is working, waiting, or unread. */
  agentHubDockAutoHide?: boolean
  /** Agent Hub alert (bubble, plus sound when enabled) when an agent asks or needs approval. */
  agentHubAlertOnNeedsInput?: boolean
  /** Agent Hub alert when an agent finishes. */
  agentHubAlertOnFinished?: boolean
  /** Agent Hub alerts play Orca's notification sound. */
  agentHubAlertSound?: boolean
  /** Agent Hub alerts stay silent until this time (ms since epoch); null when not muted. */
  agentHubAlertsMutedUntil?: number | null
  /** Agent Hub "All terminals" also lists plain shells, not only agents. */
  agentHubShowShells?: boolean
  /** Agent Hub drops finished agents from the Inbox after this many minutes; 0 keeps them until read. */
  agentHubFinishedAutoClearMinutes?: number
  /** Agent Hub tab shown on open when nobody is waiting. */
  agentHubDefaultTab?: AgentHubDefaultTab
}

export const DEFAULT_AGENT_HUB_DOCK_POSITION: AgentHubDockPosition = { edge: 'bottom', offset: 0.5 }

/** Choices for "clear finished agents after"; 0 keeps them until they are read. */
export const AGENT_HUB_FINISHED_CLEAR_MINUTES = [0, 15, 30, 60] as const

/** Muting from the dock lasts this long. */
export const AGENT_HUB_MUTE_DURATION_MS = 2 * 60 * 60 * 1000

export function normalizeAgentHubPlacement(value: unknown): AgentHubPlacement {
  return value === 'status-bar' ? 'status-bar' : 'dock'
}

export function normalizeAgentHubDockPosition(value: unknown): AgentHubDockPosition {
  if (!value || typeof value !== 'object') {
    return DEFAULT_AGENT_HUB_DOCK_POSITION
  }
  const edge = 'edge' in value ? value.edge : undefined
  const offset = 'offset' in value ? value.offset : undefined
  if (edge !== 'bottom' && edge !== 'top' && edge !== 'left' && edge !== 'right') {
    return DEFAULT_AGENT_HUB_DOCK_POSITION
  }
  return {
    edge,
    offset:
      typeof offset === 'number' && Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : 0.5
  }
}

/** The dock's scale for each size; medium is the default. */
export const AGENT_HUB_DOCK_ZOOM: Record<AgentHubDockSize, number> = {
  small: 1,
  medium: 1.25,
  large: 1.5
}

export function normalizeAgentHubDockSize(value: unknown): AgentHubDockSize {
  return value === 'small' || value === 'large' ? value : 'medium'
}

export function normalizeAgentHubDefaultTab(value: unknown): AgentHubDefaultTab {
  return value === 'running' || value === 'all' ? value : 'inbox'
}

export function normalizeAgentHubFinishedClearMinutes(value: unknown): number {
  return AGENT_HUB_FINISHED_CLEAR_MINUTES.find((minutes) => minutes === value) ?? 0
}
