import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { orbAwarenessTarget, useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'
import {
  agentHubOrbNoticeLabel,
  agentHubOrbStripRows,
  agentHubOrbStripSummary,
  type AgentHubOrbStripRow
} from './agent-hub-orb-notice-display'
import {
  openAgentHubAnswerQueue,
  useAgentHubAnswerQueueState
} from './agent-hub-answer-queue-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function RowIcon({ row }: { row: AgentHubOrbStripRow }): React.JSX.Element {
  const className = 'mt-0.5 size-3.5 shrink-0'
  if (row.group === 'update') {
    return <MessageSquare className={cn(className, 'text-muted-foreground')} />
  }
  if (row.group === 'done') {
    return <CircleCheck className={cn(className, 'text-muted-foreground')} />
  }
  return row.display.kind === 'question' ? (
    <CircleHelp className={cn(className, 'text-status-warning')} />
  ) : (
    <CircleAlert className={cn(className, 'text-status-warning')} />
  )
}

/** Collapsed by default; it opens by itself once for each newly arrived decision. */
export function AgentHubOrbFollowNotices({
  onOpenTarget
}: {
  onOpenTarget: (target: AgentHubPaneTarget) => void
}): React.JSX.Element | null {
  const snapshot = useAgentHubOrbAwarenessStore((s) => s.snapshot)
  const display = useAgentHubOrbAwarenessStore((s) => s.display)
  const answerQueue = useAgentHubAnswerQueueState()
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(
    () => agentHubOrbStripRows(snapshot?.notices ?? [], display),
    [snapshot, display]
  )
  const seenDecisions = useRef<Set<string> | null>(null)

  useEffect(() => {
    const ids = rows.filter((row) => row.group === 'decision').map((row) => row.notice.id)
    // Decisions already present when the strip mounts were seen elsewhere; only new ones open it.
    if (!seenDecisions.current) {
      seenDecisions.current = new Set(ids)
      return
    }
    const seen = seenDecisions.current
    if (ids.some((id) => !seen.has(id))) {
      setExpanded(true)
    }
    ids.forEach((id) => seen.add(id))
  }, [rows])

  if (rows.length === 0) {
    return null
  }
  const summary = agentHubOrbStripSummary(rows)
  const open = (row: AgentHubOrbStripRow): void => {
    if (row.display.kind === 'question' && answerQueue.enabled && answerQueue.count > 0) {
      openAgentHubAnswerQueue()
      return
    }
    const target = orbAwarenessTarget(row.notice.host, row.notice.paneKey)
    if (target) {
      onOpenTarget(target)
    }
  }

  return (
    <div className="shrink-0 border-b text-xs" aria-live="polite">
      <div className="px-1.5 py-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={expanded}
          className="w-full justify-start"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
          <span className="shrink-0 text-foreground">{summary.headline}</span>
          {summary.detail ? (
            <span className="min-w-0 truncate font-normal text-muted-foreground">
              · {summary.detail}
            </span>
          ) : null}
        </Button>
      </div>
      {expanded ? (
        <div className="scrollbar-sleek max-h-40 overflow-y-auto px-3 pb-2">
          {rows.map((row, index) => (
            <div key={row.notice.id}>
              {index > 0 && rows[index - 1].group !== row.group ? (
                <p className="pt-2 pb-0.5 text-muted-foreground">
                  {row.group === 'update'
                    ? translate('agentHub.orb.notices.updates', 'Updates')
                    : translate('agentHub.orb.notices.finished', 'Finished')}
                </p>
              ) : null}
              <div
                className={cn('flex items-start gap-2 py-1', row.group === 'done' && 'opacity-60')}
              >
                <RowIcon row={row} />
                <p className="line-clamp-2 min-w-0 flex-1 text-muted-foreground">
                  <span className="font-medium text-foreground">{row.notice.title}</span>
                  {' · '}
                  {agentHubOrbNoticeLabel(row.display)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={!orbAwarenessTarget(row.notice.host, row.notice.paneKey)}
                  onClick={() => open(row)}
                >
                  {row.display.kind === 'question'
                    ? translate('agentHub.orb.notices.answer', 'Answer')
                    : translate('agentHub.orb.notices.goToAgent', 'Go to agent')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
