import type { GlobalSettings } from './global-settings-types'
import { DEFAULT_AGENT_HUB_DOCK_POSITION } from './agent-hub-settings'

type AgentHubSettingKey = Extract<
  keyof GlobalSettings,
  `agentHub${string}` | 'experimentalAgentHub'
>

export const AGENT_HUB_DEFAULT_SETTINGS: Pick<GlobalSettings, AgentHubSettingKey> = {
  experimentalAgentHub: false,
  agentHubAgentControl: true,
  agentHubOrbAgent: 'claude',
  agentHubOrbModel: null,
  agentHubOrbCwd: null,
  agentHubOrbPlacement: 'floating',
  agentHubOrbSpeakReplies: false,
  agentHubOrbName: 'Orb',
  agentHubOrbTone: 'calm',
  agentHubOrbTint: 'silver',
  agentHubOrbMemorySuggestions: true,
  agentHubPlacement: 'dock',
  agentHubDockPosition: DEFAULT_AGENT_HUB_DOCK_POSITION,
  agentHubDockSize: 'medium',
  agentHubDockAutoHide: false,
  agentHubAlertOnNeedsInput: true,
  agentHubAlertOnFinished: true,
  agentHubAlertOnInfo: true,
  agentHubAlertSound: true,
  agentHubFocusedPaneOutline: true,
  agentHubPaneQuickReply: true,
  agentHubAnswerQueue: false,
  agentHubAnswerQueueOpening: 'automatically',
  agentHubAnswerQueueIncludeApprovals: false,
  agentHubAlertsMutedUntil: null,
  agentHubShowShells: true,
  agentHubFinishedAutoClearMinutes: 0,
  agentHubDefaultTab: 'inbox',
  agentHubTabAutoPopout: false,
  agentHubCanvas: true,
  agentHubRestoreOnLaunch: true
}
