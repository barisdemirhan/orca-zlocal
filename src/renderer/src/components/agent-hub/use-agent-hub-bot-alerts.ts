import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
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
  type AgentHubBotAlert,
  type AgentHubBotRunNote
} from './agent-hub-alerts'
import { agentHubBotAlertAllowed, useAgentHubBotAlertSettings } from './agent-hub-bot-alert-policy'
import type { AgentHubBotNeeds } from './agent-hub-bot-needs-store'
import { unparkAgentHubBots } from './agent-hub-bot-parked-store'
import { playAgentHubAlertSound } from './agent-hub-chime'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { detectOrbBotRunEvents, orbBotRunFacts } from './agent-hub-orb-bot-bubble'
import { agentHubBotAlertsMuted, useAgentHubBotAlertsMutedUntil } from './agent-hub-bot-alerts-mute'
import { agentHubBotMuteKey, agentHubSenderMuted } from './agent-hub-sender-mute'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import type { BotActivity } from '../../../../shared/bots/bot-activity-model'

/** Module-level so a remount of the hub does not announce what it already announced. */
const raisedBotAlertIds = new Set<string>()
const ANSWERED_ELSEWHERE_MS = 1800

/** An alert per open need; a question id is in the stamp, so a new question alerts again. */
export function openBotAlerts(needs: AgentHubBotNeeds, at: number): AgentHubBotAlert[] {
  const { bot, botKey } = needs
  return [
    ...needs.items.flatMap((item): AgentHubBotAlert[] =>
      item.question
        ? [
            {
              id: `bot:${botKey}:${item.uid}:${item.question.eventId}`,
              kind: 'ask',
              bot: { bot, botKey, at, subject: { type: 'item', item } }
            }
          ]
        : []
    ),
    ...needs.connectors.map(({ key, connector }): AgentHubBotAlert => ({
      id: `bot:${botKey}:signin:${key}`,
      kind: 'ask',
      bot: { bot, botKey, at, subject: { type: 'signin', key, connector } }
    })),
    ...needs.access.map((request): AgentHubBotAlert => ({
      id: `bot:${botKey}:access:${request.requestId}`,
      kind: 'ask',
      bot: { bot, botKey, at, subject: { type: 'access', request } }
    }))
  ]
}

function runAlerts(
  needs: AgentHubBotNeeds,
  runs: readonly AgentHubBotRunNote[],
  mode: 'summary' | 'each-run',
  at: number
): AgentHubBotAlert[] {
  const { bot, botKey } = needs
  const make = (group: readonly AgentHubBotRunNote[]): AgentHubBotAlert => ({
    id: `bot:${botKey}:runs:${group.map((run) => run.runId).join('+')}`,
    kind: group.some((run) => run.failed) ? 'failure' : 'done',
    bot: { bot, botKey, at, subject: { type: 'runs', runs: group } }
  })
  return mode === 'summary' ? (runs.length > 0 ? [make(runs)] : []) : runs.map((run) => make([run]))
}

/** An awake Orb shows its own bot's news on the sphere; one announcement is enough. */
function orbShowsBotOnSphere(needs: AgentHubBotNeeds): boolean {
  const panel = useAgentHubOrbPanel.getState()
  return (
    needs.bot.role === 'orb' &&
    panel.session !== null &&
    panel.chatVisible &&
    panel.presentation === 'orb' &&
    !panel.compact
  )
}

/**
 * Raises a bot's bubble when it starts asking, needs a sign-in or access, or an automation run of
 * it ends: new news only, never what waited when the hub mounted or the bot was first read. Answered
 * needs leave the bubble.
 */
export function useAgentHubBotAlerts(
  needs: AgentHubBotNeeds,
  loaded: boolean,
  activity: Pick<BotActivity, 'inProgress' | 'completed'> | null
): void {
  const { alertsMutedUntil } = useAgentHubPreferences()
  // Read so the effects below run again when the bots-only mute changes.
  const botsMutedUntil = useAgentHubBotAlertsMutedUntil()
  const settings = useAgentHubBotAlertSettings()
  const baselineRef = useRef<Set<string> | null>(null)
  const announce = useEffectEvent((): void => {
    if (settings.sound) {
      playAgentHubAlertSound(
        readAgentAttentionNotificationSound(useAppStore.getState().settings ?? {})
      )
    }
  })
  useEffect(() => {
    if (!loaded) {
      return
    }
    const current = openBotAlerts(needs, Date.now())
    const ids = new Set(current.map((alert) => alert.id))
    for (const queued of readAgentHubAlertQueue()) {
      if (!queued.bot || queued.bot.botKey !== needs.botKey || ids.has(queued.id)) {
        continue
      }
      const { type } = queued.bot.subject
      if (type === 'item') {
        // Why a delay: the bubble shows Answered for a moment when it was answered elsewhere.
        setTimeout(() => dismissAgentHubAlert(queued.id), ANSWERED_ELSEWHERE_MS)
      } else if (
        type === 'signin' ||
        type === 'access' ||
        (type === 'suggestion' &&
          !needs.suggestions.some(
            (entry) => `bot:${needs.botKey}:suggestion:${entry.id}` === queued.id
          ))
      ) {
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
    if (
      fresh.length === 0 ||
      orbShowsBotOnSphere(needs) ||
      !agentHubBotAlertAllowed(needs.bot, 'ask', settings) ||
      agentHubBotAlertsMuted(alertsMutedUntil) ||
      agentHubSenderMuted(agentHubBotMuteKey(needs.bot))
    ) {
      return
    }
    unparkAgentHubBots([needs.botKey])
    pushAgentHubAlerts(fresh)
    announce()
  }, [needs, loaded, settings, alertsMutedUntil, botsMutedUntil])

  const seenRunning = useRef<Map<string, string> | null>(null)
  const facts = useMemo(() => (activity ? orbBotRunFacts(activity) : null), [activity])
  useEffect(() => {
    if (!loaded || !facts) {
      return
    }
    // Why: the first read only learns which runs are running; a run seen finished is old news.
    const next = detectOrbBotRunEvents(seenRunning.current ?? new Map(), facts)
    const first = seenRunning.current === null
    seenRunning.current = next.running
    if (first || settings.automation === 'off' || next.events.length === 0) {
      return
    }
    const runs = next.events
      .filter((event) =>
        agentHubBotAlertAllowed(
          needs.bot,
          event.kind === 'failure' ? 'failure' : 'result',
          settings
        )
      )
      .map((event): AgentHubBotRunNote => ({
        runId: event.runId,
        automationId: event.automationId,
        name: event.name,
        sessionId: event.sessionId,
        failed: event.kind === 'failure'
      }))
    const fresh = takeUnraisedAlerts(
      raisedBotAlertIds,
      runAlerts(needs, runs, settings.automation, Date.now())
    )
    if (
      fresh.length === 0 ||
      orbShowsBotOnSphere(needs) ||
      agentHubBotAlertsMuted(alertsMutedUntil) ||
      agentHubSenderMuted(agentHubBotMuteKey(needs.bot))
    ) {
      return
    }
    pushAgentHubAlerts(fresh)
    announce()
  }, [facts, loaded, settings, alertsMutedUntil, botsMutedUntil, needs])

  const suggestionBaseline = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!loaded) {
      return
    }
    const current = needs.suggestions.map((suggestion): AgentHubBotAlert => ({
      id: `bot:${needs.botKey}:suggestion:${suggestion.id}`,
      kind: 'done',
      bot: {
        bot: needs.bot,
        botKey: needs.botKey,
        at: Date.now(),
        subject: { type: 'suggestion', suggestion }
      }
    }))
    const baseline = suggestionBaseline.current
    suggestionBaseline.current = new Set(current.map((alert) => alert.id))
    if (baseline === null) {
      rememberRaisedAlertIds(raisedBotAlertIds, suggestionBaseline.current)
      return
    }
    // Why off by default: an idea is not news; it waits in the Inbox unless the owner wants it said.
    if (
      !settings.onSuggestion ||
      needs.bot.paused ||
      agentHubSenderMuted(agentHubBotMuteKey(needs.bot)) ||
      agentHubBotAlertsMuted(alertsMutedUntil)
    ) {
      return
    }
    const fresh = takeUnraisedAlerts(
      raisedBotAlertIds,
      current.filter((alert) => !baseline.has(alert.id))
    )
    if (fresh.length > 0 && !orbShowsBotOnSphere(needs)) {
      pushAgentHubAlerts(fresh)
      announce()
    }
  }, [needs, loaded, settings, alertsMutedUntil, botsMutedUntil])
}
