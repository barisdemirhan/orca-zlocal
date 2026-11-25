import { getToneForAutomationRunStatus } from '../../../../shared/automation-last-run'
import type { AutomationRunStatus } from '../../../../shared/automations/history/automation-run'
import type { BotActivity } from '../../../../shared/bots/bot-activity-model'

export const ORB_SUGGESTIONS_PER_DAY = 3
const SEEN_SUGGESTIONS_LIMIT = 60

export type OrbBotRunFacts = {
  runId: string
  automationId: string
  name: string
  status: AutomationRunStatus
  sessionId: string | null
  running: boolean
  at: number
}

export type OrbBotRunEvent = {
  kind: 'failure' | 'result'
  runId: string
  automationId: string
  name: string
  sessionId: string | null
  at: number
}

export function orbBotRunFacts(
  activity: Pick<BotActivity, 'inProgress' | 'completed'>
): OrbBotRunFacts[] {
  return [...activity.inProgress, ...activity.completed].flatMap((row) =>
    row.kind === 'run'
      ? [
          {
            runId: row.runId,
            automationId: row.automationId,
            name: row.automationName,
            status: row.status,
            sessionId: row.sessionId,
            running: getToneForAutomationRunStatus(row.status) === 'running',
            at: row.at
          }
        ]
      : []
  )
}

/**
 * Runs that were running at the last look and finished since. A run first seen already finished is
 * never an event, so opening the Orb never announces old runs.
 */
export function detectOrbBotRunEvents(
  seenRunning: ReadonlyMap<string, string>,
  runs: readonly OrbBotRunFacts[]
): { running: Map<string, string>; events: OrbBotRunEvent[] } {
  const running = new Map<string, string>()
  const events: OrbBotRunEvent[] = []
  for (const run of runs) {
    if (run.running) {
      running.set(run.runId, run.name)
      continue
    }
    if (!seenRunning.has(run.runId)) {
      continue
    }
    const tone = getToneForAutomationRunStatus(run.status)
    if (tone === 'failed' || tone === 'succeeded') {
      events.push({
        kind: tone === 'failed' ? 'failure' : 'result',
        runId: run.runId,
        automationId: run.automationId,
        name: run.name,
        sessionId: run.sessionId,
        at: run.at
      })
    }
  }
  return { running, events }
}

export type OrbBotBubble =
  | { kind: 'failure' | 'result'; key: string; event: OrbBotRunEvent }
  | { kind: 'brief'; key: string }
  | { kind: 'other'; key: string; botKey: string; uid: string }
  | { kind: 'suggestion'; key: string; botKey: string; suggestionId: string; text: string }

export const BUBBLE_ORDER: readonly OrbBotBubble['kind'][] = [
  'failure',
  'result',
  'brief',
  'other',
  'suggestion'
]

/** Failure, then result, brief, other bots' questions, suggestion; none while the Orb is busy. */
export function pickOrbBotBubble(
  candidates: readonly OrbBotBubble[],
  blocked: boolean
): OrbBotBubble | null {
  if (blocked) {
    return null
  }
  for (const kind of BUBBLE_ORDER) {
    const found = candidates.find((candidate) => candidate.kind === kind)
    if (found) {
      return found
    }
  }
  return null
}

export type OrbSuggestionLedger = { day: string; shownToday: number; seen: readonly string[] }

export function localDayKey(now: number): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export const EMPTY_SUGGESTION_LEDGER: OrbSuggestionLedger = { day: '', shownToday: 0, seen: [] }

/** A suggestion shows only when the day's budget is left and its id was never shown or dismissed. */
export function orbSuggestionAllowed(
  ledger: OrbSuggestionLedger,
  suggestionId: string,
  now: number
): boolean {
  const today = ledger.day === localDayKey(now) ? ledger.shownToday : 0
  return today < ORB_SUGGESTIONS_PER_DAY && !ledger.seen.includes(suggestionId)
}

export function recordOrbSuggestionShown(
  ledger: OrbSuggestionLedger,
  suggestionId: string,
  now: number
): OrbSuggestionLedger {
  const day = localDayKey(now)
  return {
    day,
    shownToday: (ledger.day === day ? ledger.shownToday : 0) + 1,
    seen: [...ledger.seen.filter((id) => id !== suggestionId), suggestionId].slice(
      -SEEN_SUGGESTIONS_LIMIT
    )
  }
}
