import { agentHubThreadCardKey } from './agent-hub-answered-cards'
import type { NotificationSettings } from '../../../../shared/notifications/notification-settings-types'
import type { AgentPaneThread } from '../activity/activity-thread-types'
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
  /** A worker's result: shown only by that worker's minimized mirror, never by the hub. */
  mirrorOnly?: true
}
export type AgentHubRequestAlert = AgentHubInboxRequest & {
  id: string
  kind: AgentHubAlertKind | 'info'
  thread?: never
  mirrorOnly?: never
}
export type AgentHubAlert = AgentHubThreadAlert | AgentHubRequestAlert

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

export function agentHubAlertPaneKey(alert: AgentHubAlert): string {
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
