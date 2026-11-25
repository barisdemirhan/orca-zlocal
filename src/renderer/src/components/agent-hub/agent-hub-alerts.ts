import { agentHubThreadCardKey } from './agent-hub-answered-cards'
import type { NotificationSettings } from '../../../../shared/notifications/notification-settings-types'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import type { HostAccessRequest } from '@/lib/bot-access-requests'
import type { Suggestion } from '../../../../shared/bots/bot-look-around'
import type { BotConnectorEntry } from '../bots/bot-connector-entries'
import { parseExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { agentHubIsApproval, agentHubStateSince, type AgentHubLists } from './agent-hub-lists'
import {
  agentHubRequestKey,
  type AgentHubInboxRequest,
  type AgentHubRequestsState
} from './agent-hub-requests-store'

export type AgentHubAlertKind = 'ask' | 'approval' | 'done'

export type AgentHubThreadAlert = {
  id: string
  kind: AgentHubAlertKind
  thread: AgentPaneThread
  request?: never
  host?: never
  bot?: never
  /** A worker's result: shown only by that worker's minimized mirror, never by the hub. */
  mirrorOnly?: true
}
export type AgentHubRequestAlert = AgentHubInboxRequest & {
  id: string
  kind: AgentHubAlertKind | 'info'
  thread?: never
  mirrorOnly?: never
  bot?: never
}
export type AgentHubBotRunNote = {
  runId: string
  automationId: string
  name: string
  sessionId: string | null
  failed: boolean
}

export type AgentHubBotAlertSubject =
  | { type: 'item'; item: BotItem }
  | { type: 'signin'; key: string; connector: BotConnectorEntry }
  | { type: 'access'; request: HostAccessRequest }
  /** Automation runs that finished; a summary carries the whole burst, each-run one run. */
  | { type: 'runs'; runs: readonly AgentHubBotRunNote[] }
  /** One of the bot's chats (or its worker's pane) asked, finished or failed. */
  | {
      type: 'thread'
      alert: AgentHubThreadAlert
      origin: 'home' | 'side' | 'worker'
      /** The chat's session id: the same one a work record or an automation run carries. */
      session: string | null
    }
  /** A request one of the bot's chats raised through the hub. */
  | { type: 'request'; alert: AgentHubRequestAlert }
  | { type: 'suggestion'; suggestion: Suggestion }

/** What a bot has for its owner: an open question, sign-in or access request, or a run's outcome. */
export type AgentHubBotAlert = {
  id: string
  kind: 'ask' | 'done' | 'failure'
  bot: { bot: Bot; botKey: string; at: number; subject: AgentHubBotAlertSubject }
  thread?: never
  request?: never
  host?: never
  mirrorOnly?: never
}
export type AgentHubAlert = AgentHubThreadAlert | AgentHubRequestAlert | AgentHubBotAlert

export function agentHubRequestAlerts(state: AgentHubRequestsState): AgentHubRequestAlert[] {
  return [...state]
    .flatMap(([host, view]) =>
      [
        ...view.pendingGates.values(),
        ...view.pendingAsks.values(),
        ...view.pendingConsents.values(),
        ...view.notifications.values()
      ].map((request): AgentHubRequestAlert => ({
        id: agentHubRequestKey(host, request.requestId),
        host,
        request,
        kind:
          request.kind === 'ask' || request.kind === 'gate'
            ? 'ask'
            : request.kind === 'consent'
              ? 'approval'
              : request.level === 'needs-you'
                ? 'ask'
                : request.level
      }))
    )
    .sort((a, b) => a.request.createdAt - b.request.createdAt)
}

/** One slot per item, connector, request or run; a summary of runs holds the bot's one slot. */
function botAlertPaneKey(botKey: string, subject: AgentHubBotAlertSubject): string {
  switch (subject.type) {
    case 'item':
      return `bot:${botKey}:${subject.item.uid}`
    case 'signin':
      return `bot:${botKey}:signin:${subject.key}`
    case 'access':
      return `bot:${botKey}:access:${subject.request.requestId}`
    case 'thread':
      return `bot:${botKey}:${plainAlertPaneKey(subject.alert)}`
    case 'request':
      return `bot:${botKey}:${plainAlertPaneKey(subject.alert)}`
    case 'suggestion':
      return `bot:${botKey}:suggestion:${subject.suggestion.id}`
    case 'runs':
      return subject.runs.length === 1
        ? `bot:${botKey}:run:${subject.runs[0]?.runId}`
        : `bot:${botKey}:runs`
  }
}

function plainAlertPaneKey(alert: AgentHubThreadAlert | AgentHubRequestAlert): string {
  if (alert.request) {
    return JSON.stringify([alert.host, alert.request.caller.paneKey])
  }
  const host = parseExecutionHostId(alert.thread.worktree.hostId)
  return JSON.stringify([
    alert.thread.worktree.runtimeOwnerEnvironmentId ??
      (host?.kind === 'runtime' ? host.environmentId : 'local'),
    alert.thread.paneKey
  ])
}

/** The request behind an alert, plain or inside a bot's bubble. */
export function agentHubAlertRequest(alert: AgentHubAlert): AgentHubRequestAlert | null {
  if (alert.request) {
    return alert
  }
  return alert.bot?.subject.type === 'request' ? alert.bot.subject.alert : null
}

export function agentHubAlertPaneKey(alert: AgentHubAlert): string {
  return alert.bot ? botAlertPaneKey(alert.bot.botKey, alert.bot.subject) : plainAlertPaneKey(alert)
}

/** One stamp per alertable state entry, so an agent that asks again alerts again. */
function alertStamps(lists: AgentHubLists): AgentHubThreadAlert[] {
  const alerts: AgentHubThreadAlert[] = []
  for (const thread of lists.needsYou) {
    const kind = agentHubIsApproval(thread) ? 'approval' : 'ask'
    alerts.push({ id: `${agentHubThreadCardKey(thread)}:ask`, kind, thread })
  }
  for (const thread of lists.finished) {
    alerts.push({
      id: `${thread.paneKey}:done:${agentHubStateSince(thread)}`,
      kind: 'done',
      thread
    })
  }
  for (const thread of lists.finishedWorkers) {
    alerts.push({
      id: `${thread.paneKey}:done:${agentHubStateSince(thread)}`,
      kind: 'done',
      thread,
      mirrorOnly: true
    })
  }
  return alerts
}

/** The stamps of everything alertable now: the baseline the next diff compares against. */
export function agentHubAlertBaseline(lists: AgentHubLists): Set<string> {
  return new Set(alertStamps(lists).map((alert) => alert.id))
}

/** Entries that were not alertable last time, filtered by the user's alert choices. */
export function diffAgentHubAlerts(
  baseline: ReadonlySet<string>,
  lists: AgentHubLists,
  options: { onNeedsInput: boolean; onFinished: boolean }
): { baseline: Set<string>; fresh: AgentHubThreadAlert[] } {
  const current = alertStamps(lists)
  const fresh = current.filter(
    (alert) =>
      !baseline.has(alert.id) && (alert.kind === 'done' ? options.onFinished : options.onNeedsInput)
  )
  return { baseline: new Set(current.map((alert) => alert.id)), fresh }
}

/** Bounds the raised-alert memory; the oldest ids drop first. */
export const RAISED_ALERT_MEMORY_LIMIT = 200

export function rememberRaisedAlertIds(raised: Set<string>, ids: Iterable<string>): void {
  for (const id of ids) {
    raised.delete(id)
    raised.add(id)
    const oldest = raised.values().next()
    if (raised.size > RAISED_ALERT_MEMORY_LIMIT && !oldest.done) {
      raised.delete(oldest.value)
    }
  }
}

/** Alerts not raised yet, recorded as raised. Why: a result re-entering the lists must not re-alert. */
export function takeUnraisedAlerts<T extends AgentHubAlert>(
  raised: Set<string>,
  alerts: readonly T[]
): T[] {
  const unraised = alerts.filter((alert) => !raised.has(alert.id))
  rememberRaisedAlertIds(
    raised,
    unraised.map((alert) => alert.id)
  )
  return unraised
}

/**
 * True when Orca's desktop notification for this agent will make its own sound. Why: the
 * delivery service skips the banner only for the active worktree of a focused window, so the
 * hub chimes in exactly that case and never doubles up.
 */
export function orcaNotificationWillSound(args: {
  notifications: Partial<NotificationSettings> | undefined
  /** The OS refused the last banner (permission off, unsupported), so it played no sound. */
  nativeBannerRefused: boolean
  windowFocused: boolean
  activeWorktreeId: string | null
  worktreeId: string
}): boolean {
  const { notifications } = args
  if (
    args.nativeBannerRefused ||
    notifications?.enabled === false ||
    notifications?.agentTaskComplete === false
  ) {
    return false
  }
  const suppressed =
    notifications?.suppressWhenFocused !== false &&
    args.windowFocused &&
    args.activeWorktreeId === args.worktreeId
  return !suppressed
}
