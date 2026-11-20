import { translate } from '@/i18n/i18n'
import type { AgentHubOrbAwarenessNotice } from '../../../../shared/agent-hub-orb-awareness'

/** What the user sees for a notice; the model keeps the notice's own wording. */
export type AgentHubOrbNoticeDisplay =
  | { kind: 'approval' }
  | { kind: 'question'; question: string; options: number }
  | { kind: 'attention' }
  | { kind: 'update'; text: string }
  | { kind: 'done'; text: string }

export type AgentHubOrbStripRow = {
  notice: AgentHubOrbAwarenessNotice
  display: AgentHubOrbNoticeDisplay
  group: 'decision' | 'update' | 'done'
}

const GROUP_ORDER: Record<AgentHubOrbStripRow['group'], number> = {
  decision: 0,
  update: 1,
  done: 2
}

function fallbackDisplay(notice: AgentHubOrbAwarenessNotice): AgentHubOrbNoticeDisplay {
  if (notice.kind === 'info') {
    return { kind: 'update', text: notice.text }
  }
  return notice.kind === 'result' ? { kind: 'done', text: '' } : { kind: 'attention' }
}

/** Quota lives in the header chip; the strip keeps decisions first and finished work last. */
export function agentHubOrbStripRows(
  notices: readonly AgentHubOrbAwarenessNotice[],
  display: ReadonlyMap<string, AgentHubOrbNoticeDisplay>
): AgentHubOrbStripRow[] {
  return notices
    .filter((notice) => notice.kind !== 'quota')
    .map((notice) => ({
      notice,
      display: display.get(notice.id) ?? fallbackDisplay(notice),
      group:
        notice.kind === 'info'
          ? ('update' as const)
          : notice.kind === 'result'
            ? ('done' as const)
            : ('decision' as const)
    }))
    .sort((left, right) => GROUP_ORDER[left.group] - GROUP_ORDER[right.group])
}

export function agentHubOrbNoticeLabel(display: AgentHubOrbNoticeDisplay): string {
  switch (display.kind) {
    case 'approval':
      return translate('agentHub.orb.notices.approval', 'Waiting for approval')
    case 'question':
      return display.options === 0
        ? translate('agentHub.orb.notices.question', 'Asks: {{question}}', {
            question: display.question
          })
        : display.options === 1
          ? translate('agentHub.orb.notices.questionOneOption', 'Asks: {{question}} · 1 option', {
              question: display.question
            })
          : translate(
              'agentHub.orb.notices.questionOptions',
              'Asks: {{question}} · {{count}} options',
              { question: display.question, count: display.options }
            )
    case 'attention':
      return translate('agentHub.orb.notices.attention', 'Needs attention')
    case 'update':
      return display.text
    case 'done':
      return display.text || translate('agentHub.orb.notices.done', 'Finished')
  }
}

function countLabel(group: AgentHubOrbStripRow['group'], count: number): string {
  if (group === 'decision') {
    return count === 1
      ? translate('agentHub.orb.notices.needsYouOne', '1 agent needs you')
      : translate('agentHub.orb.notices.needsYouMany', '{{count}} agents need you', { count })
  }
  if (group === 'update') {
    return count === 1
      ? translate('agentHub.orb.notices.updateOne', '1 update')
      : translate('agentHub.orb.notices.updateMany', '{{count}} updates', { count })
  }
  return count === 1
    ? translate('agentHub.orb.notices.finishedOne', '1 finished')
    : translate('agentHub.orb.notices.finishedMany', '{{count}} finished', { count })
}

/** Collapsed strip line: the most urgent group leads, the others follow as counts. */
export function agentHubOrbStripSummary(rows: readonly AgentHubOrbStripRow[]): {
  headline: string
  detail: string
} {
  const lead = rows[0]?.group ?? 'decision'
  const leadRows = rows.filter((row) => row.group === lead)
  const agents = new Set(
    leadRows.map((row) => JSON.stringify([row.notice.host, row.notice.paneKey]))
  )
  const names = [...new Set(leadRows.map((row) => row.notice.title))]
  const rest = (['update', 'done'] as const)
    .filter((group) => GROUP_ORDER[group] > GROUP_ORDER[lead])
    .flatMap((group) => {
      const count = rows.filter((row) => row.group === group).length
      return count > 0 ? [countLabel(group, count)] : []
    })
  return {
    headline: countLabel(lead, lead === 'decision' ? agents.size : leadRows.length),
    detail: [names.join(', '), ...rest].join(' · ')
  }
}
