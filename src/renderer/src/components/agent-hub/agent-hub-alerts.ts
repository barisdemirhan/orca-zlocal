import type { NotificationSettings } from '../../../../shared/notification-settings-types'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { agentHubIsApproval, agentHubStateSince, type AgentHubLists } from './agent-hub-lists'

export type AgentHubAlertKind = 'ask' | 'approval' | 'done'

export type AgentHubAlert = {
  id: string
  kind: AgentHubAlertKind
  thread: AgentPaneThread
  /** A worker's result: shown only by that worker's minimized mirror, never by the hub. */
  mirrorOnly?: true
}

/** One stamp per alertable state entry, so an agent that asks again alerts again. */
function alertStamps(lists: AgentHubLists): AgentHubAlert[] {
  const alerts: AgentHubAlert[] = []
  for (const thread of lists.needsYou) {
    const kind = agentHubIsApproval(thread) ? 'approval' : 'ask'
    alerts.push({ id: `${thread.paneKey}:ask:${agentHubStateSince(thread)}`, kind, thread })
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
): { baseline: Set<string>; fresh: AgentHubAlert[] } {
  const current = alertStamps(lists)
  const fresh = current.filter(
    (alert) =>
      !baseline.has(alert.id) && (alert.kind === 'done' ? options.onFinished : options.onNeedsInput)
  )
  return { baseline: new Set(current.map((alert) => alert.id)), fresh }
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
