import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import {
  isNativeAgentBannerRefused,
  readAgentAttentionNotificationSound
} from '@/attention/agent-attention-notification-delivery'
import {
  isOrcaWindowForegroundFocused,
  isVisibleForegroundPaneKey
} from '../terminal-pane/terminal-notification-pane-visibility'
import { pushAgentHubAlerts } from './agent-hub-alert-queue'
import {
  agentHubAlertBaseline,
  diffAgentHubAlerts,
  orcaNotificationWillSound,
  rememberRaisedAlertIds,
  takeUnraisedAlerts
} from './agent-hub-alerts'
import { playAgentHubAlertSound } from './agent-hub-chime'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubTargetShowsThread } from './agent-hub-pane-target'
import type { AgentHubLists } from './agent-hub-lists'
import type { AgentHubPreferences } from './use-agent-hub-settings'

/** Module-level so a remount of the hub does not forget what was already announced. */
const raisedAlertIds = new Set<string>()

/**
 * Queues an alert when an agent starts asking, needs approval, or finishes. A reader of the
 * agent-status store like every other surface: it diffs the hub's lists, never produces status.
 */
export function useAgentHubAlerts(lists: AgentHubLists, preferences: AgentHubPreferences): void {
  const baselineRef = useRef<Set<string> | null>(null)
  const { alertOnNeedsInput, alertOnFinished, alertSound, alertsMutedUntil } = preferences

  useEffect(() => {
    // Why a baseline first: whatever is already waiting at mount was seen elsewhere.
    if (baselineRef.current === null) {
      baselineRef.current = agentHubAlertBaseline(lists)
      rememberRaisedAlertIds(raisedAlertIds, baselineRef.current)
      return
    }
    const diff = diffAgentHubAlerts(baselineRef.current, lists, {
      onNeedsInput: alertOnNeedsInput,
      onFinished: alertOnFinished
    })
    baselineRef.current = diff.baseline
    const fresh = takeUnraisedAlerts(raisedAlertIds, diff.fresh)
    if (fresh.length === 0 || (alertsMutedUntil ?? 0) > Date.now()) {
      return
    }
    const state = useAppStore.getState()
    // The pane the user is looking at needs no alert: they are watching it happen.
    const { chips } = readAgentHubMirrors()
    const unseen = fresh.filter(
      (alert) =>
        !isVisibleForegroundPaneKey(state, alert.thread.worktree.id, alert.thread.paneKey) &&
        (!alert.mirrorOnly ||
          chips.some((chip) =>
            chip.window.tabs.some((tab) => agentHubTargetShowsThread(tab.target, alert.thread))
          ))
    )
    if (unseen.length === 0) {
      return
    }
    pushAgentHubAlerts(unseen)
    const windowFocused = isOrcaWindowForegroundFocused()
    const quietElsewhere = unseen.some(
      (alert) =>
        !orcaNotificationWillSound({
          notifications: state.settings?.notifications,
          nativeBannerRefused: isNativeAgentBannerRefused(),
          windowFocused,
          activeWorktreeId: state.activeWorktreeId,
          worktreeId: alert.thread.worktree.id
        })
    )
    if (alertSound && quietElsewhere) {
      playAgentHubAlertSound(readAgentAttentionNotificationSound(state.settings ?? {}))
    }
  }, [lists, alertOnNeedsInput, alertOnFinished, alertSound, alertsMutedUntil])
}
