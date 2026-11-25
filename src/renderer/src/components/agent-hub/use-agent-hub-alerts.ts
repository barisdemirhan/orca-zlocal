import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import {
  isNativeAgentBannerRefused,
  readAgentAttentionNotificationSound
} from '@/attention/agent-attention-notification-delivery'
import { isOrcaWindowForegroundFocused } from '@/attention/orca-window-foreground-focus'
import { createTerminalAttentionSurface } from '../terminal-pane/notifications/terminal-attention-surface'
import {
  pruneAgentHubBotChatAsks,
  pruneAgentHubRequestAlerts,
  pushAgentHubAlerts
} from './agent-hub-alert-queue'
import {
  agentHubAlertBaseline,
  agentHubRequestAlerts,
  diffAgentHubAlerts,
  orcaNotificationWillSound,
  rememberRaisedAlertIds,
  takeUnraisedAlerts
} from './agent-hub-alerts'
import { agentHubBotAlertsMuted } from './agent-hub-bot-alerts-mute'
import { routeRequestAlertsToBots, routeThreadAlertsToBots } from './agent-hub-bot-alert-routing'
import { readAgentHubBotAlertSettings } from './agent-hub-bot-alert-policy'
import { agentHubPaneMuteKey, agentHubSenderMuted } from './agent-hub-sender-mute'
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
    // Why both on: a bot's chat is governed by the bot's switches, decided after routing.
    const diff = diffAgentHubAlerts(baselineRef.current, lists, {
      onNeedsInput: true,
      onFinished: true
    })
    baselineRef.current = diff.baseline
    pruneAgentHubBotChatAsks(diff.baseline)
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
    const routed = routeThreadAlertsToBots(unseen)
    const agentAlerts = routed.agents.filter(
      (alert) =>
        !agentHubSenderMuted(agentHubPaneMuteKey(alert.thread.paneKey)) &&
        (alert.kind === 'done' ? alertOnFinished : alertOnNeedsInput)
    )
    if (routed.bots.length > 0 && !agentHubBotAlertsMuted(null)) {
      pushAgentHubAlerts(routed.bots)
      if (readAgentHubBotAlertSettings().sound) {
        playAgentHubAlertSound(readAgentAttentionNotificationSound(state.settings ?? {}))
      }
    }
    if (agentAlerts.length === 0) {
      return
    }
    pushAgentHubAlerts(agentAlerts)
    const windowFocused = isOrcaWindowForegroundFocused()
    const quietElsewhere = agentAlerts.some(
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
    const unraised = takeUnraisedAlerts(raisedAlertIds, agentHubRequestAlerts(requests))
    if (unraised.length === 0 || (alertsMutedUntil ?? 0) > Date.now()) {
      return
    }
    const routed = routeRequestAlertsToBots(unraised)
    if (routed.bots.length > 0 && !agentHubBotAlertsMuted(null)) {
      pushAgentHubAlerts(routed.bots)
      if (readAgentHubBotAlertSettings().sound) {
        playAgentHubAlertSound(
          readAgentAttentionNotificationSound(useAppStore.getState().settings ?? {})
        )
      }
    }
    const fresh = routed.agents.filter(
      (alert) =>
        !agentHubSenderMuted(agentHubPaneMuteKey(alert.request.caller.paneKey)) &&
        (alert.kind === 'done'
          ? alertOnFinished
          : alert.kind === 'info'
            ? alertOnInfo
            : alertOnNeedsInput)
    )
    if (fresh.length === 0) {
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
