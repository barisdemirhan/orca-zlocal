import { useEffect, useRef } from 'react'
import { GitPullRequest, Inbox, ListTodo, PencilLine, Settings2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import type { AgentHubMirrorDrawer } from './agent-hub-mirror-drawer-store'
import type { MirrorChanges, MirrorReview, MirrorWork } from './agent-hub-mirror-card-facts'
import { reviewFailedCount } from './agent-hub-mirror-card-facts'

type Chip = {
  drawer: AgentHubMirrorDrawer
  icon: React.ReactNode
  label: string
  /** What stays when the strip is narrow; empty keeps only the icon. */
  short?: string
  title?: string
  tone?: 'fail'
}

function workChip(work: MirrorWork, asleep: boolean, plan: string | null): Chip {
  const parts = [
    work.subagents.length > 0
      ? translate('agentHub.mirror.strip.subagents', '{{count}} subagents', {
          count: work.subagents.length,
          defaultValue_one: '{{count}} subagent'
        })
      : null,
    work.commands.length > 0
      ? translate('agentHub.mirror.strip.commands', '{{count}} commands', {
          count: work.commands.length,
          defaultValue_one: '{{count}} command'
        })
      : null,
    work.workers.length > 0
      ? translate('agentHub.mirror.strip.workers', '{{count}} workers', {
          count: work.workers.length,
          defaultValue_one: '{{count}} worker'
        })
      : null
  ].filter((part) => part !== null)
  return {
    drawer: 'work',
    icon: <ListTodo />,
    label:
      plan && !asleep && work.running === 0
        ? plan
        : asleep || work.running === 0
          ? translate('agentHub.mirror.strip.idle', 'Idle')
          : translate('agentHub.mirror.strip.running', '{{count}} running', {
              count: work.running
            }),
    title: parts.length > 0 ? parts.join(' · ') : undefined
  }
}

/** One row of chips under the conversation; a chip is drawn only when something feeds it. */
export function AgentHubMirrorWorkStrip({
  work,
  queued,
  changes,
  review,
  contextPercent,
  planProgress,
  isAgent,
  shown,
  asleep,
  offline,
  onToggle
}: {
  work: MirrorWork
  /** Null when this agent's queue is not reported. */
  queued: number | null
  changes: MirrorChanges | null
  review: MirrorReview | null
  /** The chat's context use when it reports one. */
  contextPercent: number | null
  /** The plan's done/total as text, such as 2/5; null without a plan. */
  planProgress: string | null
  isAgent: boolean
  shown: AgentHubMirrorDrawer | null
  asleep: boolean
  offline: boolean
  onToggle: (drawer: AgentHubMirrorDrawer) => void
}): React.JSX.Element {
  const chips: Chip[] = []
  if (isAgent) {
    chips.push(workChip(work, asleep, planProgress))
    chips.push({
      drawer: 'inbound',
      icon: <Inbox />,
      label:
        queued === null
          ? translate('agentHub.mirror.strip.inbound', 'Inbound')
          : translate('agentHub.mirror.strip.queued', '{{count}} queued', { count: queued })
    })
  }
  if (changes) {
    chips.push({
      drawer: 'changes',
      icon: <PencilLine />,
      label:
        changes.entries.length === 0
          ? translate('agentHub.mirror.strip.clean', 'No changes')
          : `+${changes.added} −${changes.removed}`
    })
  }
  if (review) {
    const failed = reviewFailedCount(review.review)
    chips.push({
      drawer: 'pr',
      icon: <GitPullRequest />,
      label: `${translate('agentHub.mirror.strip.review', 'PR #{{number}}', { number: review.review.number })}${failed > 0 ? ` ✗${failed}` : ''}`,
      tone: failed > 0 ? 'fail' : undefined
    })
  }
  if (isAgent) {
    chips.push({
      drawer: 'settings',
      icon: <Settings2 />,
      label:
        contextPercent === null
          ? translate('agentHub.mirror.strip.settings', 'Settings')
          : translate('agentHub.mirror.strip.context', 'Context {{percent}}%', {
              percent: Math.round(contextPercent)
            }),
      short: contextPercent === null ? '' : `${Math.round(contextPercent)}%`,
      title: translate('agentHub.mirror.strip.settings', 'Settings')
    })
  }
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    barRef.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [shown])
  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={translate('agentHub.mirror.strip.label', 'Work strip')}
      className="scrollbar-sleek @container flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-popover px-2"
    >
      {chips.map((chip) => (
        <button
          key={chip.drawer}
          type="button"
          disabled={offline}
          title={chip.title}
          aria-label={chip.short !== undefined ? (chip.title ?? chip.label) : undefined}
          aria-pressed={shown === chip.drawer}
          onClick={() => onToggle(chip.drawer)}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground @max-[460px]:px-1.5',
            'hover:bg-accent aria-pressed:bg-accent aria-pressed:text-foreground disabled:opacity-40 [&_svg]:size-3',
            chip.tone === 'fail' && 'text-destructive'
          )}
        >
          {chip.icon}
          {chip.short !== undefined ? (
            <>
              <span className="@max-[460px]:hidden">{chip.label}</span>
              <span className="hidden @max-[460px]:inline">{chip.short}</span>
            </>
          ) : (
            chip.label
          )}
        </button>
      ))}
    </div>
  )
}
