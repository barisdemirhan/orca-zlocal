import type { AppState } from '@/store/types'
import { resolveOpenTabOccupantAgent } from '@/lib/agent-session/tab-identity/open-tab-occupant-agent'
import { resolveRuntimePaneTitleForLeaf } from '../../../../shared/workspace-layout/terminal-topology/runtime-pane-title-leaf-id'
import { hasRemoteRuntimePtyForTab } from '@/lib/agent-session/tab-identity/tab-agent-remote-pty-selector'
import { worktreeUsesRemoteConnection } from '@/store/terminals/tabs/creation/terminal-workspace-routing'
import { isTerminalLeafId, makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { detectAgentStatusFromTitle } from '../../../../shared/agent-status/title/agent-title-status'
import { titleShowsNoAgent } from '../../../../shared/agent-status/process/shell-process-detection'
import { collectAgentTitleEvidence } from '../../../../shared/agent-status/title/agent-title-evidence'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { TerminalAgent } from '../../../../shared/agent-status/identity/terminal-agent'

/** The store fields that can name a tab's agent when no hook status does. */
export type AgentHubIdleAgentSignals = Pick<
  AppState,
  | 'terminalLayoutsByTabId'
  | 'runtimePaneTitlesByTabId'
  | 'agentStatusByPaneKey'
  | 'sleepingAgentSessionsByPaneKey'
  | 'paneForegroundAgentByPaneKey'
  | 'ptyIdsByTabId'
  | 'repos'
  | 'worktreesByRepo'
  | 'folderWorkspaces'
  | 'projectGroups'
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
): TerminalAgent | null {
  const layout = signals.terminalLayoutsByTabId[tab.id]
  const liveTitle = layout?.activeLeafId
    ? resolveRuntimePaneTitleForLeaf(
        layout,
        signals.runtimePaneTitlesByTabId[tab.id],
        layout.activeLeafId
      )
    : null
  const title = liveTitle ?? tab.title
  const isRemote =
    worktreeUsesRemoteConnection(signals, tab.worktreeId) ||
    hasRemoteRuntimePtyForTab(signals.ptyIdsByTabId[tab.id], layout?.ptyIdsByLeafId)
  const focusedPaneKey =
    layout?.activeLeafId && isTerminalLeafId(layout.activeLeafId)
      ? makePaneKey(tab.id, layout.activeLeafId)
      : null
  const foreground = focusedPaneKey ? signals.paneForegroundAgentByPaneKey[focusedPaneKey] : null
  // Why: the tab strip clears an exited agent only for tabs it renders; a pane popped out of another
  // workspace has none, so OSC 133;D (shell back in front, local only) retires its launch record here.
  if (!isRemote && foreground?.shellForeground && !foreground.agent) {
    return null
  }
  const occupant = resolveOpenTabOccupantAgent({
    tabId: tab.id,
    title,
    defaultTitle: tab.defaultTitle,
    launchAgent: tab.launchAgent,
    layout,
    agentStatusByPaneKey: signals.agentStatusByPaneKey,
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
