import type { AppState } from '@/store/types'
import { resolveOpenTabOccupantAgent } from '@/lib/open-tab-occupant-agent'
import { resolveRuntimePaneTitleForLeaf } from '@/lib/runtime-pane-title-leaf-id'
import { detectAgentStatusFromTitle, titleShowsNoAgent } from '../../../../shared/agent-detection'
import { collectAgentTitleEvidence } from '../../../../shared/agent-title-evidence'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { TuiAgent } from '../../../../shared/tui-agent'

/** The store fields that can name a tab's agent when no hook status does. */
export type AgentHubIdleAgentSignals = Pick<
  AppState,
  | 'terminalLayoutsByTabId'
  | 'runtimePaneTitlesByTabId'
  | 'agentStatusByPaneKey'
  | 'retainedAgentsByPaneKey'
  | 'sleepingAgentSessionsByPaneKey'
  | 'paneForegroundAgentByPaneKey'
>

/**
 * The agent sitting quiet in a tab that has no activity thread: after a restart, an agent that
 * is open but idle reports nothing, so its tab would read as a plain shell. Uses the tab strip's
 * own identity ladder (launch record, sleeping session, process read), then the title's vendor
 * mark — a hand-started Claude titles its tab "✳ task" without ever naming itself.
 */
export function resolveAgentHubIdleAgent(
  tab: TerminalTab,
  signals: AgentHubIdleAgentSignals
): TuiAgent | null {
  const layout = signals.terminalLayoutsByTabId[tab.id]
  const liveTitle = layout?.activeLeafId
    ? resolveRuntimePaneTitleForLeaf(
        layout,
        signals.runtimePaneTitlesByTabId[tab.id],
        layout.activeLeafId
      )
    : null
  const title = liveTitle ?? tab.title
  const occupant = resolveOpenTabOccupantAgent({
    tabId: tab.id,
    title,
    defaultTitle: tab.defaultTitle,
    launchAgent: tab.launchAgent,
    layout,
    agentStatusByPaneKey: signals.agentStatusByPaneKey,
    retainedAgentsByPaneKey: signals.retainedAgentsByPaneKey,
    sleepingAgentSessionsByPaneKey: signals.sleepingAgentSessionsByPaneKey,
    paneForegroundAgentByPaneKey: signals.paneForegroundAgentByPaneKey
  })
  if (occupant) {
    return occupant
  }
  if (titleShowsNoAgent(title, tab.defaultTitle) || detectAgentStatusFromTitle(title) === null) {
    return null
  }
  return collectAgentTitleEvidence(title).agent
}
