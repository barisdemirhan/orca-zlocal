export type AgentHubInboxOrder = 'bots-first' | 'agents-first'
export type AgentHubDockCounters = 'agents' | 'agents-and-bots'
export type AgentHubBotAutomationAlerts = 'summary' | 'each-run' | 'off'
export type AgentHubMirrorDrawerPosition = 'auto' | 'side' | 'bottom'
export type AgentHubOrbNewChatAction = 'new-chat' | 'clear-home'

/** How the hub's panel, dock, bot notifications, mirrors and Orb window behave. */
export type AgentHubSurfaceSettings = {
  /** Agents may open their own card's drawers and read its work; never another agent's card. */
  agentHubAgentOwnCard?: boolean
  /** Card events are also sent to the agent as a note; off means they are read on request. */
  agentHubSendCardEvents?: boolean
  agentHubInboxOrder?: AgentHubInboxOrder
  agentHubFoldIdleAgents?: boolean
  /** Bots' own chats stay listed in Agents; off leaves one closing line that opens Bots. */
  agentHubShowBotChatsInAgents?: boolean
  agentHubRememberListState?: boolean
  agentHubDockCounters?: AgentHubDockCounters
  agentHubBotAlertOnAsk?: boolean
  agentHubBotAlertOnResult?: boolean
  agentHubBotAlertOnFailure?: boolean
  agentHubBotAlertOnSuggestion?: boolean
  agentHubBotAutomationAlerts?: AgentHubBotAutomationAlerts
  agentHubBotAlertSound?: boolean
  agentHubBotNameInDesktopNotifications?: boolean
  agentHubMirrorWorkStrip?: boolean
  agentHubMirrorDrawerPosition?: AgentHubMirrorDrawerPosition
  agentHubMirrorOpenOnFailedCheck?: boolean
  agentHubOrbOpenChatsLimit?: number
  agentHubOrbNewChatAction?: AgentHubOrbNewChatAction
  /** A live conversation stays with its chat when another chat is shown. */
  agentHubOrbKeepLiveOnSwitch?: boolean
}

export const AGENT_HUB_ORB_OPEN_CHATS_LIMITS = [4, 8, 10] as const

export const AGENT_HUB_SURFACE_DEFAULTS: Required<AgentHubSurfaceSettings> = {
  agentHubAgentOwnCard: true,
  agentHubSendCardEvents: false,
  agentHubInboxOrder: 'bots-first',
  agentHubFoldIdleAgents: true,
  agentHubShowBotChatsInAgents: false,
  agentHubRememberListState: true,
  agentHubDockCounters: 'agents',
  agentHubBotAlertOnAsk: true,
  agentHubBotAlertOnResult: true,
  agentHubBotAlertOnFailure: true,
  agentHubBotAlertOnSuggestion: false,
  agentHubBotAutomationAlerts: 'summary',
  agentHubBotAlertSound: true,
  agentHubBotNameInDesktopNotifications: true,
  agentHubMirrorWorkStrip: true,
  agentHubMirrorDrawerPosition: 'auto',
  agentHubMirrorOpenOnFailedCheck: false,
  agentHubOrbOpenChatsLimit: 8,
  agentHubOrbNewChatAction: 'new-chat',
  agentHubOrbKeepLiveOnSwitch: true
}

const CHOICES: { [K in keyof AgentHubSurfaceSettings]?: readonly unknown[] } = {
  agentHubInboxOrder: ['bots-first', 'agents-first'],
  agentHubDockCounters: ['agents', 'agents-and-bots'],
  agentHubBotAutomationAlerts: ['summary', 'each-run', 'off'],
  agentHubMirrorDrawerPosition: ['auto', 'side', 'bottom'],
  agentHubOrbOpenChatsLimit: AGENT_HUB_ORB_OPEN_CHATS_LIMITS,
  agentHubOrbNewChatAction: ['new-chat', 'clear-home']
}

function isSurfaceValue<K extends keyof AgentHubSurfaceSettings>(
  key: K,
  value: unknown
): value is Required<AgentHubSurfaceSettings>[K] {
  const choices = CHOICES[key]
  return choices ? choices.includes(value) : typeof value === 'boolean'
}

/** One setting with its default applied, so a profile saved before the key existed reads sanely. */
export function agentHubSurfaceSetting<K extends keyof AgentHubSurfaceSettings>(
  settings: AgentHubSurfaceSettings | null | undefined,
  key: K
): Required<AgentHubSurfaceSettings>[K] {
  const value: unknown = settings?.[key]
  return isSurfaceValue(key, value) ? value : AGENT_HUB_SURFACE_DEFAULTS[key]
}
