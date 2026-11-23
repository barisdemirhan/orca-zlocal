import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { findStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { refreshLocalStructuredSessionTabs } from '@/runtime/local-structured-session-tabs-sync/inventory-refresh'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/workspace-mounting/background-terminal-worktree-mount'
import type { AgentHubOrbOpenParams } from '../../../../shared/agent-hub-orb'
import type { AgentHubOrbAction } from '../../../../shared/agent-hub-settings'
import { normalizeAgentHubOrbSettings } from '../../../../shared/agent-hub-orb-settings'
import { showAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

import { agentHubOrbErrorMessage } from './agent-hub-orb-error'

let opening: Promise<boolean> | null = null
let openingKey: string | null = null
let openingCanJoin = false
async function open(
  params: AgentHubOrbOpenParams | undefined,
  preserveVisibility: boolean,
  closeGeneration: number,
  hostOpened: () => void,
  action?: AgentHubOrbAction
): Promise<boolean> {
  try {
    const session = await window.api.agentHub.orb.open(params)
    hostOpened()
    const where = {
      workspaceId: session.workspaceId ?? FLOATING_TERMINAL_WORKTREE_ID,
      sessionId: session.sessionId,
      target: { kind: 'local' as const }
    }
    let tab = findStructuredAgentSessionTab(useAppStore.getState().unifiedTabsByWorktree, where)
    if (!tab) {
      await refreshLocalStructuredSessionTabs()
      tab = findStructuredAgentSessionTab(useAppStore.getState().unifiedTabsByWorktree, where)
    }
    if (!tab) {
      throw new Error('Orb tab was not published')
    }
    if (session.workspaceId) {
      // The Orb bot's workspace is usually off screen; its chat must still mount for the Orb to show it.
      requestBackgroundTerminalWorktreeMount({ worktreeId: session.workspaceId, tabIds: [tab.id] })
    }
    if (useAgentHubOrbPanel.getState().closeGeneration !== closeGeneration) {
      return true
    }
    if (preserveVisibility) {
      if (useAgentHubOrbPanel.getState().session) {
        useAgentHubOrbPanel.setState({ session: { ...session, tabId: tab.id } })
      }
    } else {
      showAgentHubOrbPanel({ ...session, tabId: tab.id }, action)
    }
    return true
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
    if (!useAgentHubOrbPanel.getState().session) {
      toast.error(
        code === 'disabled'
          ? translate('auto.agentHub.orb.disabled', 'Enable Agent control to talk to Orb')
          : code
            ? agentHubOrbErrorMessage(
                error,
                translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.')
              )
            : translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.')
      )
    }
    return false
  }
}

export function openAgentHubOrb(
  params?: AgentHubOrbOpenParams,
  preserveVisibility = false,
  action?: AgentHubOrbAction
): Promise<boolean> {
  const closeGeneration = useAgentHubOrbPanel.getState().closeGeneration
  const settings = normalizeAgentHubOrbSettings(useAppStore.getState().settings ?? {})
  const key = JSON.stringify({
    resume: params?.resume?.sessionId,
    agent: params?.agent,
    model: params?.model,
    cwd: params?.cwd,
    fresh: params?.fresh,
    agentSetting: settings.agent,
    modelSetting: settings.model,
    permission: settings.permission,
    preserveVisibility,
    action,
    closeGeneration
  })
  if (opening && openingCanJoin && openingKey === key) {
    return opening
  }
  const next = (opening ?? Promise.resolve())
    .then(() =>
      open(
        params,
        preserveVisibility,
        closeGeneration,
        () => {
          if (opening === next) {
            openingCanJoin = false
          }
        },
        action
      )
    )
    .finally(() => {
      if (opening === next) {
        opening = null
        openingKey = null
        openingCanJoin = false
        useAgentHubOrbPanel.setState({ opening: false })
      }
    })
  opening = next
  openingKey = key
  openingCanJoin = true
  useAgentHubOrbPanel.setState({ opening: true })
  return next
}
