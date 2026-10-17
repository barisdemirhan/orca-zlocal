import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { getActivityThreadWorkspaceTitle } from '@/lib/activity-thread-display'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubMirrorWindows, AGENT_HUB_MIRROR_TAB_CAP } from './agent-hub-mirror-membership'
import { agentHubMirrorTabCapReason } from './agent-hub-mirror-tab-actions'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'

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
  let started = false
  const reportWorkspace = (): void => {
    toast.message(
      translate(
        'auto.agentHub.mirror.newAgentStartedInWorkspace',
        '{{agent}} started in {{workspace}}.',
        { agent: label, workspace: getActivityThreadWorkspaceTitle(worktree) }
      ),
      {
        description: translate(
          'auto.agentHub.mirror.newAgentNotAdded',
          'It could not be added to this mirror. Open it from the workspace tabs.'
        )
      }
    )
  }
  try {
    const launched = await launchAgentBackgroundSession({
      agent,
      worktreeId: worktree.id,
      launchSource: 'tab_bar_quick_launch'
    })
    if (!launched) {
      throw new Error(
        translate('agentHub.mirror.newAgentUnavailable', 'The new terminal is not available.')
      )
    }
    started = true
    // A mirror is user-owned; it must never retain automation's retirement subscription.
    launched.terminalOwnership?.release()
    const pane = parsePaneKey(launched.paneKey)
    const store = useAppStore.getState()
    const tab = store.tabsByWorktree[worktree.id]?.find((tab) => tab.id === launched.tabId)
    if (!tab || pane?.tabId !== tab.id) {
      reportWorkspace()
      return true
    }
    const added = addAgentHubMirrorTab(
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
    )
    if (added.status !== 'changed') {
      reportWorkspace()
    }
    return true
  } catch (error) {
    if (started) {
      reportWorkspace()
      return true
    }
    toast.error(
      translate('agentHub.mirror.newAgentFailed', 'Could not start {{agent}}.', { agent: label }),
      { description: error instanceof Error ? error.message : String(error) }
    )
    return false
  }
}
