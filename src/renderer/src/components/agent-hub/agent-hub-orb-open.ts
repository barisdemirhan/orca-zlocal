import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { findStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { refreshLocalStructuredSessionTabs } from '@/runtime/local-structured-session-tabs-sync'
import type { AgentHubOrbOpenParams } from '../../../../shared/agent-hub-orb'
import { showAgentHubOrbPanel } from './agent-hub-orb-panel-store'

let opening: Promise<void> | null = null
async function open(params?: AgentHubOrbOpenParams): Promise<void> {
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
    showAgentHubOrbPanel({ ...session, tabId: tab.id })
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
    const message =
      typeof error === 'object' && error !== null && 'message' in error ? error.message : null
    if (code === 'invalid_argument' && typeof message === 'string' && /folder/i.test(message)) {
      const store = useAppStore.getState()
      store.openSettingsTarget({ pane: 'agentHub', repoId: null })
      store.openSettingsPage()
      toast(
        translate('auto.agentHub.orb.chooseFolderFirst', "Choose the Orb's working folder first")
      )
    } else {
      toast.error(
        code === 'disabled'
          ? translate('auto.agentHub.orb.disabled', 'Enable Agent control to talk to Orb')
          : translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.')
      )
    }
  }
}

export function openAgentHubOrb(params?: AgentHubOrbOpenParams): Promise<void> {
  if (!opening) {
    opening = open(params).finally(() => {
      opening = null
    })
  }
  return opening
}
