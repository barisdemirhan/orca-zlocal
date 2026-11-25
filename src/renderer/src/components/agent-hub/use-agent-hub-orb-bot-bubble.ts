import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { botRefKey } from '@/lib/bot-hosts'
import { useNow } from '@/lib/window-activity/use-now'
import { useBotActivityRead } from '../bots/use-bot-activity'
import { botAutomationCardRows, botNextRun } from '../bots/bot-automation-card'
import { useAgentHubOrbNeedsList } from './agent-hub-bot-needs-store'
import { orbAskEntries, type OrbAskEntry } from './agent-hub-orb-ask-entries'
import { useAgentHubOrbBot } from './use-agent-hub-orb-bot'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { useAgentHubOrbBotBubbleStore } from './agent-hub-orb-bot-bubble-store'
import {
  BUBBLE_ORDER,
  detectOrbBotRunEvents,
  localDayKey,
  orbBotRunFacts,
  orbSuggestionAllowed,
  pickOrbBotBubble,
  type OrbBotBubble,
  type OrbBotRunEvent
} from './agent-hub-orb-bot-bubble'
import {
  orbBriefFinishedCount,
  orbBriefGreeting,
  orbBriefNextAt,
  orbBriefParts,
  orbBriefWindowStart
} from './agent-hub-orb-bot-brief'
import type { Bot } from '../../../../shared/bot-types'

/** A written reply keeps the bubble slot for this long, as it does under the sphere. */
const REPLY_FRESH_MS = 12_000

export type AgentHubOrbBotBubbleView = {
  bubble: OrbBotBubble
  /** The brief's one line, or the asking bot's name and the questions it has. */
  text: string
  /** The bot a bubble acts on: the Orb's own, or the one that asks. */
  bot: Bot | null
}

function useReplyFresh(replyKey: string | undefined): boolean {
  // Why: a reply that was already on screen when this mounted is old news.
  const mountKey = useRef(replyKey)
  const [freshKey, setFreshKey] = useState<string | null>(null)
  useEffect(() => {
    if (!replyKey || replyKey === mountKey.current) {
      return
    }
    setFreshKey(replyKey)
    const timer = window.setTimeout(() => setFreshKey(null), REPLY_FRESH_MS)
    return () => window.clearTimeout(timer)
  }, [replyKey])
  return freshKey !== null && freshKey === replyKey
}

/**
 * The Orb as a bot: its own and other bots' questions, its automations' orbit, ring and result
 * bubbles, the daily brief and its suggestions. `busy` says the Orb is already talking or listening.
 */
export function useAgentHubOrbBotBubble({
  busy,
  idle,
  replyKey,
  replyPending
}: {
  busy: boolean
  idle: boolean
  replyKey: string | undefined
  replyPending: boolean
}) {
  const orbBot = useAgentHubOrbBot()
  const otherBots = useAppStore((s) => s.settings?.agentHubOrbOtherBots === true)
  const needs = useAgentHubOrbNeedsList()
  const activity = useBotActivityRead(orbBot)
  const clock = useNow(60_000)
  const dismissedCaption = useAgentHubOrbPanel((s) => s.dismissedCaption)
  const persisted = useAgentHubOrbBotBubbleStore((s) => s.persisted)
  const dismissed = useAgentHubOrbBotBubbleStore((s) => s.dismissed)
  const dismissKey = useAgentHubOrbBotBubbleStore((s) => s.dismiss)
  const markSuggestionShown = useAgentHubOrbBotBubbleStore((s) => s.markSuggestionShown)
  const markBriefDone = useAgentHubOrbBotBubbleStore((s) => s.markBriefDone)
  const replyFresh = useReplyFresh(replyKey)

  const entries = useMemo(() => orbAskEntries(needs, otherBots), [needs, otherBots])
  const count = entries.length
  const ownNeeds = needs.find((entry) => entry.bot.role === 'orb')
  const ownCount = entries.filter((entry) => entry.own).length
  const putOff = (entry: OrbAskEntry): boolean =>
    dismissed.includes(`later:${entry.askKey}`) || dismissed.includes(`other:${entry.askKey}`)
  // Why: asks put off with Later keep their badge but stop calling for attention until a new one comes.
  const attention = entries.some((entry) => !putOff(entry))

  const [askOpen, setAskOpen] = useState(false)
  const [askFocus, setAskFocus] = useState<string | null>(null)
  const askEntry = askOpen ? (entries.find((e) => e.key === askFocus) ?? null) : null
  const asking = askEntry !== null

  const [events, setEvents] = useState<OrbBotRunEvent[]>([])
  const [ring, setRing] = useState<{ id: number; tone: 'success' | 'error' } | null>(null)
  const seenRunning = useRef<Map<string, string>>(new Map())
  const facts = useMemo(() => (activity ? orbBotRunFacts(activity) : []), [activity])
  const orbit = facts.some((run) => run.running)
  useEffect(() => {
    if (!activity) {
      return
    }
    const next = detectOrbBotRunEvents(seenRunning.current, facts)
    seenRunning.current = next.running
    if (next.events.length > 0) {
      setEvents((current) => [...current, ...next.events].slice(-20))
      const failed = next.events.some((event) => event.kind === 'failure')
      setRing((current) => ({ id: (current?.id ?? 0) + 1, tone: failed ? 'error' : 'success' }))
    }
  }, [activity, facts])

  const today = localDayKey(clock)
  const [brief, setBrief] = useState<{ key: string; text: string } | null>(null)
  const briefCheckedDay = useRef('')
  useEffect(() => {
    // Why: the Orb bot's needs are published by its watcher after its activity lands; counting early reads 0.
    if (
      briefCheckedDay.current === today ||
      !activity ||
      !orbBot ||
      !ownNeeds ||
      persisted.briefDay === today
    ) {
      return
    }
    briefCheckedDay.current = today
    const now = Date.now()
    const nextRow = botNextRun(botAutomationCardRows(orbBot, activity, now))
    const parts = orbBriefParts({
      questions: ownCount,
      finished: orbBriefFinishedCount(
        activity.completed,
        orbBriefWindowStart(now, persisted.briefAt)
      ),
      nextAt: orbBriefNextAt(nextRow?.nextAt ?? null, now)
    })
    if (parts.length === 0) {
      markBriefDone(now)
      return
    }
    setBrief({
      key: `brief:${today}`,
      text: [orbBriefGreeting(now), parts.join(' · ')].join(' — ')
    })
  }, [
    activity,
    orbBot,
    ownNeeds,
    persisted.briefDay,
    persisted.briefAt,
    today,
    ownCount,
    markBriefDone
  ])

  const candidates = useMemo(() => {
    const out: OrbBotBubble[] = []
    const gone = new Set(dismissed)
    for (const event of events.toReversed()) {
      const key = `${event.kind}:${event.runId}`
      if (!gone.has(key)) {
        out.push({ kind: event.kind, key, event })
      }
    }
    if (brief && !gone.has(brief.key)) {
      out.push({ kind: 'brief', key: brief.key })
    }
    const other = entries.find(
      (entry) =>
        !entry.own && !gone.has(`other:${entry.askKey}`) && !gone.has(`later:${entry.askKey}`)
    )
    if (other) {
      out.push({
        kind: 'other',
        key: `other:${other.askKey}`,
        botKey: botRefKey(other.bot),
        uid: other.item.uid
      })
    }
    if (idle && ownNeeds) {
      const suggestion = ownNeeds.suggestions.find(
        (s) =>
          !gone.has(`suggestion:${s.id}`) && orbSuggestionAllowed(persisted.ledger, s.id, clock)
      )
      if (suggestion) {
        out.push({
          kind: 'suggestion',
          key: `suggestion:${suggestion.id}`,
          botKey: botRefKey(ownNeeds.bot),
          suggestionId: suggestion.id,
          text: suggestion.title
        })
      }
    }
    return out
  }, [events, brief, entries, ownNeeds, idle, dismissed, persisted.ledger, clock])

  const blocked = busy || asking || replyFresh || replyPending
  const picked = pickOrbBotBubble(candidates, blocked)
  const [shown, setShown] = useState<OrbBotBubble | null>(null)
  const shownStillValid =
    shown !== null &&
    !dismissed.includes(shown.key) &&
    (shown.kind === 'failure' ||
      shown.kind === 'result' ||
      shown.kind === 'brief' ||
      (shown.kind === 'other' && entries.some((e) => e.key === `${shown.botKey}:${shown.uid}`)) ||
      (shown.kind === 'suggestion' &&
        Boolean(ownNeeds?.suggestions.some((s) => s.id === shown.suggestionId))))
  useEffect(() => {
    if (!shownStillValid && shown !== null) {
      setShown(null)
      return
    }
    if (!picked || picked.key === shown?.key) {
      return
    }
    if (shown && BUBBLE_ORDER.indexOf(picked.kind) >= BUBBLE_ORDER.indexOf(shown.kind)) {
      return
    }
    setShown(picked)
    const now = Date.now()
    if (picked.kind === 'suggestion') {
      markSuggestionShown(picked.suggestionId, now)
    } else if (picked.kind === 'brief') {
      markBriefDone(now)
    }
  }, [picked, shown, shownStillValid, dismissKey, markBriefDone, markSuggestionShown])

  // Why: the bubble's own close button reports through the panel's dismissed caption.
  useEffect(() => {
    if (shown && dismissedCaption === shown.key) {
      dismissKey(shown.key)
    }
  }, [dismissedCaption, shown, dismissKey])

  // Why: a result goes by itself like a reply does, unless the pointer or focus is on it.
  const resultKey = shown?.kind === 'result' && !blocked ? shown.key : null
  useEffect(() => {
    if (!resultKey) {
      return
    }
    let timer = 0
    const expire = (): void => {
      const held = document.querySelector('[data-agent-hub-orb-captions]:is(:hover, :focus-within)')
      if (held) {
        timer = window.setTimeout(expire, 2000)
      } else {
        dismissKey(resultKey)
      }
    }
    timer = window.setTimeout(expire, REPLY_FRESH_MS)
    return () => window.clearTimeout(timer)
  }, [resultKey, dismissKey])

  let view: AgentHubOrbBotBubbleView | null = null
  if (shown && shownStillValid && !blocked) {
    const entry =
      shown.kind === 'other' ? entries.find((e) => e.key === `${shown.botKey}:${shown.uid}`) : null
    const others = entries.filter((e) => !e.own).length
    view = {
      bubble: shown,
      text:
        shown.kind === 'brief'
          ? (brief?.text ?? '')
          : shown.kind === 'other'
            ? `${entry?.bot.name ?? ''}${others > 1 ? ` · ${others}` : ''}`
            : '',
      bot:
        shown.kind === 'other'
          ? (entry?.bot ?? null)
          : shown.kind === 'suggestion'
            ? (ownNeeds?.bot ?? null)
            : orbBot
    }
  }

  return {
    orbBot,
    count,
    orbit,
    ring,
    askEntry,
    asking,
    hasAsks: count > 0,
    view,
    attention,
    openAsk: (key?: string): void => {
      setAskFocus(key ?? (entries.find((entry) => !putOff(entry)) ?? entries[0])?.key ?? null)
      setAskOpen(true)
    },
    closeAsk: (): void => setAskOpen(false),
    dismiss: (key: string): void => dismissKey(key),
    later: (entry: OrbAskEntry): void => {
      dismissKey(`later:${entry.askKey}`)
      setAskOpen(false)
    }
  }
}
