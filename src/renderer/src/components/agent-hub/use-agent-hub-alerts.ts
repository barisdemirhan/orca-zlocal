import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import {
  isNativeAgentBannerRefused,
  readAgentAttentionNotificationSound
} from '@/attention/agent-attention-notification-delivery'
import { isOrcaWindowForegroundFocused } from '@/attention/orca-window-foreground-focus'
import { createTerminalAttentionSurface } from '../terminal-pane/notifications/terminal-attention-surface'
import { pushAgentHubAlerts, pruneAgentHubRequestAlerts } from './agent-hub-alert-queue'
import {
  agentHubAlertBaseline,
  agentHubRequestAlerts,
  diffAgentHubAlerts,
  orcaNotificationWillSound,
  rememberRaisedAlertIds,
  takeUnraisedAlerts
} from './agent-hub-alerts'
import { playAgentHubAlertSound } from './agent-hub-chime'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubTargetShowsThread } from './agent-hub-pane-target'
import type { AgentHubLists } from './agent-hub-lists'
import type { AgentHubPreferences } from './use-agent-hub-settings'
import { useAgentHubRequests } from './agent-hub-requests-store'

/** Module-level so a remount of the hub does not forget what was already announced. */
const raisedAlertIds = new Set<string>()

/**
 * Queues an alert when an agent starts asking, needs approval, or finishes. A reader of the
 * agent-status store like every other surface: it diffs the hub's lists, never produces status.
 */
export function useAgentHubAlerts(lists: AgentHubLists, preferences: AgentHubPreferences): void {
  const baselineRef = useRef<Set<string> | null>(null)
  const requests = useAgentHubRequests()
  const { alertOnNeedsInput, alertOnFinished, alertOnInfo, alertSound, alertsMutedUntil } =
    preferences

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
    // The pane the user is looking at needs no alert: they are watching it happen. The canvas
    // covers the workspace, so nothing there is being looked at while it is open.
    const { chips } = readAgentHubMirrors()
    const surface = createTerminalAttentionSurface(state)
    const canvasOpen = isAgentHubCanvasOpen()
    const unseen = fresh.filter(
      (alert) =>
        (canvasOpen ||
          !surface.isSurfaceViewed({
            workspaceId: alert.thread.worktree.id,
            surfaceKey: alert.thread.paneKey
          })) &&
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

  useEffect(() => {
    pruneAgentHubRequestAlerts(requests)
    const fresh = takeUnraisedAlerts(raisedAlertIds, agentHubRequestAlerts(requests)).filter(
      (alert) =>
        alert.kind === 'done'
          ? alertOnFinished
          : alert.kind === 'info'
            ? alertOnInfo
            : alertOnNeedsInput
    )
    if (fresh.length === 0 || (alertsMutedUntil ?? 0) > Date.now()) {
      return
    }
    pushAgentHubAlerts(fresh)
    if (
      alertSound &&
      fresh.some((alert) => alert.request.kind !== 'notify' || alert.request.sound)
    ) {
      playAgentHubAlertSound(
        readAgentAttentionNotificationSound(useAppStore.getState().settings ?? {})
      )
    }
  }, [requests, alertOnNeedsInput, alertOnFinished, alertOnInfo, alertSound, alertsMutedUntil])
}
