import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { getActivityThreadWorkspaceTitle } from '@/lib/activity-thread-display'
import { runtimeEnvironmentIdOrLocalUnlessTwin } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { makePaneKey, parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { toWebTerminalSurfaceTabId } from '../../../../shared/workspace-layout/terminal-surface-id'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubMirrorWindows, AGENT_HUB_MIRROR_TAB_CAP } from './agent-hub-mirror-membership'
import { agentHubMirrorTabCapReason } from './agent-hub-mirror-tab-actions'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { agentHubMirrorPaneExists, agentHubMirrorShellLeafId } from './agent-hub-mirror-source'

const REMOTE_TAB_WAIT_MS = 10_000

/** The tab and pane the mirror must track for a freshly launched agent. */
async function resolveLaunchedMirrorPane(
  worktreeId: string,
  launchedTabId: string,
  launchedPaneKey: string
): Promise<{ tab: TerminalTab; paneKey: string } | null> {
  const pane = parsePaneKey(launchedPaneKey)
  if (pane?.tabId !== launchedTabId) {
    return null
  }
  const environmentId = runtimeEnvironmentIdOrLocalUnlessTwin(useAppStore.getState(), worktreeId)
  // Why: a runtime host's tab reaches this client as web-terminal-<hostTabId> one sync later,
  // replacing the reserved local tab; tracking the reserved id would be pruned as closed.
  const tabId = environmentId ? toWebTerminalSurfaceTabId(launchedTabId) : launchedTabId
  const paneKey = environmentId ? makePaneKey(tabId, pane.leafId) : launchedPaneKey
  const find = (): { tab: TerminalTab; paneKey: string } | null => {
    const state = useAppStore.getState()
    const tab = state.tabsByWorktree[worktreeId]?.find((entry) => entry.id === tabId)
    return tab && (!environmentId || agentHubMirrorPaneExists(state, tabId, paneKey))
      ? { tab, paneKey }
      : null
  }
  const found = find()
  if (found || !environmentId) {
    return found
  }
  return new Promise((resolve) => {
    const finish = (result: { tab: TerminalTab; paneKey: string } | null): void => {
      clearTimeout(timer)
      unsubscribe()
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), REMOTE_TAB_WAIT_MS)
    const unsubscribe = useAppStore.subscribe(() => {
      const next = find()
      if (next) {
        finish(next)
      }
    })
  })
}

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
    const launched = launchAgentInNewTab({
      requestId: newAgentLaunchRequestId(),
      agent,
      worktreeId: worktree.id,
      launchSource: 'tab_bar_quick_launch',
      activate: false
    })
    if (!launched) {
      throw new Error(
        translate('agentHub.mirror.newAgentUnavailable', 'The new terminal is not available.')
      )
    }
    if ('refused' in launched) {
      return false
    }
    started = true
    if (launched.surface.kind !== 'local-terminal') {
      reportWorkspace()
      return true
    }
    const launchedTabId = launched.surface.tabId
    const leafId = agentHubMirrorShellLeafId(
      useAppStore.getState().terminalLayoutsByTabId[launchedTabId]
    )
    const resolved = leafId
      ? await resolveLaunchedMirrorPane(
          worktree.id,
          launchedTabId,
          makePaneKey(launchedTabId, leafId)
        )
      : null
    if (!resolved) {
      reportWorkspace()
      return true
    }
    const { tab, paneKey } = resolved
    const added = addAgentHubMirrorTab(
      windowId,
      {
        worktree,
        repo: useAppStore.getState().repos.find((repo) => repo.id === worktree.repoId) ?? null,
        tab,
        paneKey,
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
