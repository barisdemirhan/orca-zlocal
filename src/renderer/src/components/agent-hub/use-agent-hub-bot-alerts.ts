import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { readAgentAttentionNotificationSound } from '@/attention/agent-attention-notification-delivery'
import {
  dismissAgentHubAlert,
  pushAgentHubAlerts,
  readAgentHubAlertQueue
} from './agent-hub-alert-queue'
import {
  rememberRaisedAlertIds,
  takeUnraisedAlerts,
  type AgentHubBotAlert
} from './agent-hub-alerts'
import type { AgentHubBotNeeds } from './agent-hub-bot-needs-store'
import { playAgentHubAlertSound } from './agent-hub-chime'
import { useAgentHubPreferences } from './use-agent-hub-settings'

/** Module-level so a remount of the hub does not announce what it already announced. */
const raisedBotAlertIds = new Set<string>()

/** An alert per asking item; its question id is in the stamp, so a new question alerts again. */
function botAlertsOf(needs: AgentHubBotNeeds): AgentHubBotAlert[] {
  return needs.items.flatMap((item) =>
    item.question
      ? [
          {
            id: `bot:${needs.botKey}:${item.uid}:${item.question.eventId}`,
            kind: 'ask' as const,
            bot: { bot: needs.bot, botKey: needs.botKey, item }
          }
        ]
      : []
  )
}

/**
 * Raises "<Bot> is asking" when an item starts asking: a new ask, never one already waiting when
 * the hub mounted or the bot's items were first read. Answered asks leave the bubble.
 */
export function useAgentHubBotAlerts(needs: AgentHubBotNeeds, loaded: boolean): void {
  const { alertOnNeedsInput, alertSound, alertsMutedUntil } = useAgentHubPreferences()
  const baselineRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!loaded) {
      return
    }
    const current = botAlertsOf(needs)
    const ids = new Set(current.map((alert) => alert.id))
    for (const queued of readAgentHubAlertQueue()) {
      if (queued.bot?.botKey === needs.botKey && !ids.has(queued.id)) {
        dismissAgentHubAlert(queued.id)
      }
    }
    const baseline = baselineRef.current
    baselineRef.current = ids
    if (baseline === null) {
      rememberRaisedAlertIds(raisedBotAlertIds, ids)
      return
    }
    const fresh = takeUnraisedAlerts(
      raisedBotAlertIds,
      current.filter((alert) => !baseline.has(alert.id))
    )
    if (fresh.length === 0 || !alertOnNeedsInput || (alertsMutedUntil ?? 0) > Date.now()) {
      return
    }
    pushAgentHubAlerts(fresh)
    if (alertSound) {
      playAgentHubAlertSound(
        readAgentAttentionNotificationSound(useAppStore.getState().settings ?? {})
      )
    }
  }, [needs, loaded, alertOnNeedsInput, alertSound, alertsMutedUntil])
}
