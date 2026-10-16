import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { findStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { refreshLocalStructuredSessionTabs } from '@/runtime/local-structured-session-tabs-sync'
import type { AgentHubOrbOpenParams } from '../../../../shared/agent-hub-orb'
import { showAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

import { agentHubOrbErrorMessage } from './agent-hub-orb-error'

let opening: Promise<boolean> | null = null
async function open(
  params: AgentHubOrbOpenParams | undefined,
  preserveVisibility: boolean
): Promise<boolean> {
  try {
    const session = await window.api.agentHub.orb.open(params)
    let store = useAppStore.getState()
    let tab = findStructuredAgentSessionTab(store.unifiedTabsByWorktree, {
      workspaceId: FLOATING_TERMINAL_WORKTREE_ID,
      sessionId: session.sessionId,
      target: { kind: 'local' }
    })
    if (!tab) {
      await refreshLocalStructuredSessionTabs()
      store = useAppStore.getState()
      tab = findStructuredAgentSessionTab(store.unifiedTabsByWorktree, {
        workspaceId: FLOATING_TERMINAL_WORKTREE_ID,
        sessionId: session.sessionId,
        target: { kind: 'local' }
      })
    }
    if (!tab) {
      throw new Error('Orb tab was not published')
    }
    if (preserveVisibility) {
      if (useAgentHubOrbPanel.getState().session) {
        useAgentHubOrbPanel.setState({ session: { ...session, tabId: tab.id } })
      }
    } else {
      showAgentHubOrbPanel({ ...session, tabId: tab.id })
    }
    return true
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
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
    return false
  }
}

export function openAgentHubOrb(
  params?: AgentHubOrbOpenParams,
  preserveVisibility = false
): Promise<boolean> {
  if (!opening) {
    opening = open(params, preserveVisibility).finally(() => {
      opening = null
    })
  }
  return opening
}
