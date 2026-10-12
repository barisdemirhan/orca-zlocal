import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubMirrorWindows, AGENT_HUB_MIRROR_TAB_CAP } from './agent-hub-mirror-membership'
import {
  addAgentHubMirrorTabWithFeedback,
  agentHubMirrorTabCapReason
} from './agent-hub-mirror-tab-actions'

export async function startAgentInAgentHubMirror(
  windowId: string,
  worktree: Worktree,
  agent: TuiAgent
): Promise<boolean> {
  const window = agentHubMirrorWindows(readAgentHubMirrors()).find((entry) => entry.id === windowId)
  if (!window) {
    return false
  }
  if (window.tabs.length >= AGENT_HUB_MIRROR_TAB_CAP) {
    toast.error(agentHubMirrorTabCapReason())
    return false
  }
  const label = getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
  try {
    const launched = await launchAgentBackgroundSession({
      agent,
      worktreeId: worktree.id,
      launchSource: 'tab_bar_quick_launch'
    })
    // A mirror is user-owned; it must never retain automation's retirement subscription.
    launched?.terminalOwnership?.release()
    const pane = launched && parsePaneKey(launched.paneKey)
    const store = useAppStore.getState()
    const tab =
      launched && store.tabsByWorktree[worktree.id]?.find((tab) => tab.id === launched.tabId)
    if (!launched || !tab || pane?.tabId !== tab.id) {
      throw new Error(
        translate('agentHub.mirror.newAgentUnavailable', 'The new terminal is not available.')
      )
    }
    return (
      addAgentHubMirrorTabWithFeedback(
        windowId,
        {
          worktree,
          repo: store.repos.find((repo) => repo.id === worktree.repoId) ?? null,
          tab,
          paneKey: launched.paneKey,
          title: tab.customTitle ?? tab.title,
          agentType: agent
        },
        false
      ).status === 'changed'
    )
  } catch (error) {
    toast.error(
      translate('agentHub.mirror.newAgentFailed', 'Could not start {{agent}}.', { agent: label }),
      { description: error instanceof Error ? error.message : String(error) }
    )
    return false
  }
}
