import { translate } from '@/i18n/i18n'
import { uiDateTimeFormat } from '@/i18n/ui-intl-formatters'
import type { BotActivity } from '../../../../shared/bots/bot-activity-model'
import { getToneForAutomationRunStatus } from '../../../../shared/automation-last-run'

const HOUR_MS = 3_600_000
const BRIEF_LOOKBACK_MS = 24 * HOUR_MS
/** Without a last brief, "overnight" reaches back to the evening before. */
const EVENING_BEFORE_HOURS = 6

export type OrbBriefFacts = {
  questions: number
  finished: number
  /** The soonest scheduled run, only when it falls within a day. */
  nextAt: number | null
}

function startOfLocalDay(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Where "finished overnight" starts: the last brief, else the evening before, never over a day back. */
export function orbBriefWindowStart(now: number, lastBriefAt: number | null): number {
  const floor = now - BRIEF_LOOKBACK_MS
  return Math.max(floor, lastBriefAt ?? startOfLocalDay(now) - EVENING_BEFORE_HOURS * HOUR_MS)
}

export function orbBriefFinishedCount(completed: BotActivity['completed'], since: number): number {
  return completed.filter(
    (row) =>
      row.kind === 'run' &&
      row.at >= since &&
      getToneForAutomationRunStatus(row.status) === 'succeeded'
  ).length
}

export function orbBriefNextAt(nextAt: number | null, now: number): number | null {
  return nextAt !== null && nextAt > now && nextAt - now <= BRIEF_LOOKBACK_MS ? nextAt : null
}

export function orbBriefGreeting(now: number): string {
  const hour = new Date(now).getHours()
  if (hour < 12) {
    return translate('agentHub.orb.bot.greetingMorning', 'Good morning')
  }
  return hour < 18
    ? translate('agentHub.orb.bot.greetingAfternoon', 'Good afternoon')
    : translate('agentHub.orb.bot.greetingEvening', 'Good evening')
}

/** The brief's one line, from records on hand; empty when there is nothing to say. */
export function orbBriefParts(facts: OrbBriefFacts): string[] {
  const parts: string[] = []
  if (facts.questions > 0) {
    parts.push(
      translate('agentHub.orb.bot.briefQuestions', '{{count}} questions waiting', {
        count: facts.questions
      })
    )
  }
  if (facts.finished > 0) {
    parts.push(
      translate('agentHub.orb.bot.briefFinished', '{{count}} automations finished overnight', {
        count: facts.finished
      })
    )
  }
  if (facts.nextAt !== null) {
    const time = uiDateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(facts.nextAt)
    parts.push(translate('agentHub.orb.bot.briefNext', 'next at {{time}}', { time }))
  }
  return parts
}
