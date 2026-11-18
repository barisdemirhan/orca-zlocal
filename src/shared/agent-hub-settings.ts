import type { PersistedUIState } from './orca-profiles/persisted-ui-state-types'
import type { StructuredAgentId } from './agent-session/lifecycle/provider-handles/agent-session-provider-handle'
import type { AgentHubOrbTint, AgentHubOrbTone } from './agent-hub-orb-identity'

/** Where the Agent Hub lives: a draggable dock on a window edge, or a status-bar item. */
export type AgentHubPlacement = 'dock' | 'status-bar'

export type AgentHubDockEdge = 'bottom' | 'top' | 'left' | 'right'

/** The dock's edge and its spot along that edge, 0 (start) to 1 (end). */
export type AgentHubDockPosition = { edge: AgentHubDockEdge; offset: number }

export type AgentHubDefaultTab = 'inbox' | 'running' | 'agents' | 'all'

export type AgentHubMicMode = 'dictate' | 'improve'

export type AgentHubOrbAction = 'live' | 'dictate' | 'text'

export type AgentHubAnswerQueueOpening = 'automatically' | 'shortcut'

export type AgentHubDockSize = 'small' | 'medium' | 'large'

/**
 * Dimming behind floating windows: none, always while one is open, until a click behind them
 * lifts it (a click on a floating window brings it back), or always with a click behind sending
 * the mirrors to the hub.
 */
export type AgentHubFloatingDimMode = 'off' | 'on' | 'untilClick' | 'minimizeOnClick'

/** How floating windows are laid out between the sidebars: a grid, one row, or one column. */
export type AgentHubFloatingLayout = 'grid' | 'columns' | 'rows'

/** How the hub's Agents and All terminals lists are ordered: the sidebar's own sort choices. */
export type AgentHubTerminalSort = PersistedUIState['sortBy']

/** Agent Hub's settings, kept out of global-settings-types.ts (at its line budget). */
export type AgentHubSettings = {
  /** Experimental: Agent Hub — every agent and terminal in one popover, with inline answers. */
  experimentalAgentHub?: boolean
  /** Agent requests are consumed only while this permission and the experiment are enabled. */
  agentHubAgentControl?: boolean
  agentHubOrbAgent?: StructuredAgentId
  agentHubOrbModel?: string | null
  /** Absent until chosen. `free` is Full access; the other chat modes are newer values. */
  agentHubOrbPermission?: 'ask' | 'free' | 'accept-edits' | 'auto'
  agentHubOrbCwd?: string | null
  agentHubOrbPlacement?: 'floating' | 'dock' | 'statusBar' | 'hidden'
  agentHubOrbPosition?: { x: number; y: number }
  agentHubOrbDiameter?: number
  /** The sphere sits small beside the dock instead of floating. */
  agentHubOrbPinned?: boolean
  /** The mini chat window's size once resized; null or absent means the default. */
  agentHubOrbMiniSize?: { width: number; height: number } | null
  agentHubOrbDefaultAction?: AgentHubOrbAction
  agentHubOrbAlternateAction?: AgentHubOrbAction
  agentHubOrbSpeakReplies?: boolean
  /** What Orb calls itself; blank means "Orb". */
  agentHubOrbName?: string
  agentHubOrbTone?: AgentHubOrbTone
  /** Colours the idle sphere only; state colours never change. */
  agentHubOrbTint?: AgentHubOrbTint
  /** Whether Orb may propose lasting memories; absent means on. */
  agentHubOrbMemorySuggestions?: boolean
  /** The mirror microphone’s default action; unsupported controllers fall back to plain dictation. */
  agentHubMicMode?: AgentHubMicMode
  /** Agent Hub: a draggable dock on a window edge (default) or a status-bar item. */
  agentHubPlacement?: AgentHubPlacement
  /** Agent Hub dock: the window edge it sits on and its spot along that edge. */
  agentHubDockPosition?: AgentHubDockPosition
  /** Agent Hub dock: how large it is drawn. */
  agentHubDockSize?: AgentHubDockSize
  /** Dim everything behind floating windows (mirrors, the floating workspace) to spotlight them. */
  agentHubFloatingDimMode?: AgentHubFloatingDimMode
  /** Agent Hub dock: stay out of sight while no agent is working, waiting, or unread. */
  agentHubDockAutoHide?: boolean
  /** Agent Hub alert (bubble, plus sound when enabled) when an agent asks or needs approval. */
  agentHubAlertOnNeedsInput?: boolean
  /** Agent Hub alert when an agent finishes. */
  agentHubAlertOnFinished?: boolean
  agentHubAlertOnInfo?: boolean
  /** Agent Hub alerts play Orca's notification sound. */
  agentHubAlertSound?: boolean
  /** Agent Hub alerts stay silent until this time (ms since epoch); null when not muted. */
  agentHubAlertsMutedUntil?: number | null
  /** A question or approval from a terminal agent also opens as a card inside its pane. */
  agentHubPaneQuickReply?: boolean
  agentHubAnswerQueue?: boolean
  agentHubAnswerQueueOpening?: AgentHubAnswerQueueOpening
  agentHubAnswerQueueIncludeApprovals?: boolean
  /** A thin outline on the terminal pane that has the keyboard: where typing and dictation go. */
  agentHubFocusedPaneOutline?: boolean
  /** Agent Hub "All terminals" also lists plain shells, not only agents. */
  agentHubShowShells?: boolean
  /** Agent Hub drops finished agents from the Inbox after this many minutes; 0 keeps them until read. */
  agentHubFinishedAutoClearMinutes?: number
  /** Agent Hub tray: seconds its pile stays fanned out when a parked mirror speaks up; 0 never. */
  agentHubTrayPeekSeconds?: number
  /** Agent Hub: how many mirror windows stay open at once; opening more parks the oldest. */
  agentHubMirrorWindowCap?: number
  /** Agent Hub: the layout used when mirrors are brought back or popped out together. */
  agentHubFloatingLayout?: AgentHubFloatingLayout
  /** Agent Hub: the order of the Agents and All terminals lists. */
  agentHubTerminalSort?: AgentHubTerminalSort
  /** Agent Hub tab shown on open when nobody is waiting. */
  agentHubDefaultTab?: AgentHubDefaultTab
  /** Show a button on terminal tabs to open their terminal in a mirror. */
  agentHubTabAutoPopout?: boolean
  /** The one-time shortcut suggestions have been considered; manual removals stay empty. */
  agentHubShortcutsInitialized?: boolean
  /** Agent Hub: enable the separate mirrors canvas, its controls and session restoration. */
  agentHubCanvas?: boolean
  /** Agent Hub: mirrors, the tray and the canvas come back as they were when Orca restarts. */
  agentHubRestoreOnLaunch?: boolean
}

export const DEFAULT_AGENT_HUB_DOCK_POSITION: AgentHubDockPosition = { edge: 'bottom', offset: 0.5 }

/** Choices for "clear finished agents after"; 0 keeps them until they are read. */
export const AGENT_HUB_FINISHED_CLEAR_MINUTES = [0, 15, 30, 60] as const

/** Choices for how many mirror windows may be open at once. */
export const AGENT_HUB_MIRROR_WINDOW_CAP_MIN = 1
export const AGENT_HUB_MIRROR_WINDOW_CAP_MAX = 15
export const DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP = 4

/** Choices for how long the tray fans out on news; 0 leaves it piled. */
export const AGENT_HUB_TRAY_PEEK_SECONDS = [0, 3, 5, 10] as const

/** Muting from the dock lasts this long. */
export const AGENT_HUB_MUTE_DURATION_MS = 2 * 60 * 60 * 1000

export function agentHubFloatingDimMode(
  settings: Pick<AgentHubSettings, 'agentHubFloatingDimMode'> | null | undefined
): AgentHubFloatingDimMode {
  const mode = settings?.agentHubFloatingDimMode
  if (mode === 'off' || mode === 'on' || mode === 'untilClick' || mode === 'minimizeOnClick') {
    return mode
  }
  return 'off'
}

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
  return value === 'running' || value === 'agents' || value === 'all' ? value : 'inbox'
}

const AGENT_HUB_TERMINAL_SORTS: readonly AgentHubTerminalSort[] = [
  'name',
  'smart',
  'recent',
  'repo',
  'manual'
]

/** Agent Activity unless the user picked another order. */
export function normalizeAgentHubTerminalSort(value: unknown): AgentHubTerminalSort {
  return AGENT_HUB_TERMINAL_SORTS.find((sort) => sort === value) ?? 'smart'
}

export function normalizeAgentHubFinishedClearMinutes(value: unknown): number {
  return AGENT_HUB_FINISHED_CLEAR_MINUTES.find((minutes) => minutes === value) ?? 0
}

export function normalizeAgentHubTrayPeekSeconds(value: unknown): number {
  return AGENT_HUB_TRAY_PEEK_SECONDS.find((seconds) => seconds === value) ?? 5
}

export function normalizeAgentHubFloatingLayout(value: unknown): AgentHubFloatingLayout {
  return value === 'columns' || value === 'rows' ? value : 'grid'
}

export function normalizeAgentHubMirrorWindowCap(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP
  }
  return Math.min(AGENT_HUB_MIRROR_WINDOW_CAP_MAX, Math.max(AGENT_HUB_MIRROR_WINDOW_CAP_MIN, value))
}

export function normalizeAgentHubMicMode(value: unknown): AgentHubMicMode {
  return value === 'improve' ? 'improve' : 'dictate'
}

export function normalizeAgentHubAlertOnInfo(value: unknown): boolean {
  return value !== false
}

export function normalizeAgentHubAnswerQueue(settings: AgentHubSettings | null | undefined) {
  return {
    answerQueue: settings?.agentHubAnswerQueue === true,
    answerQueueOpening:
      settings?.agentHubAnswerQueueOpening === 'shortcut'
        ? ('shortcut' as const)
        : ('automatically' as const),
    answerQueueIncludeApprovals: settings?.agentHubAnswerQueueIncludeApprovals === true
  }
}
