import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { ExternalLink } from 'lucide-react'
import type { MirrorReview } from './agent-hub-mirror-card-facts'
import {
  type MirrorPrContext,
  threadFirstLine,
  useAgentHubMirrorPrActions,
  useAgentHubMirrorReviewThreads
} from './use-agent-hub-mirror-pr-actions'
import { DrawerLink, DrawerRow, DrawerSection } from './AgentHubMirrorDrawerParts'

function stateLabel(state: MirrorReview['review']['state']): string {
  switch (state) {
    case 'open':
      return translate('agentHub.mirror.drawer.prOpen', 'Open')
    case 'draft':
      return translate('agentHub.mirror.drawer.prDraft', 'Draft')
    case 'merged':
      return translate('agentHub.mirror.drawer.prMerged', 'Merged')
    case 'closed':
      return translate('agentHub.mirror.drawer.prClosed', 'Closed')
  }
}

function openUrl(url: string): void {
  void window.api.shell.openUrl(url)
}

/** The PR and its checks as the review caches already hold them; nothing here fetches. */
export function AgentHubMirrorReviewDrawer({
  card,
  review: { review, failedChecks }
}: {
  card: MirrorPrContext
  review: MirrorReview
}): React.JSX.Element {
  const { worktreeId } = card
  const threads = useAgentHubMirrorReviewThreads(card, review, true)
  const actions = useAgentHubMirrorPrActions(card, review)
  const summary = review.checksSummary
  // Merge itself stays in Orca's Checks panel, with its confirmation and method choice.
  const openMerge = (): void => {
    activateAndRevealWorktree(worktreeId)
    const store = useAppStore.getState()
    store.setRightSidebarOpen(true)
    store.setRightSidebarTab('checks')
  }
  return (
    <>
      <DrawerSection
        label={`${translate('agentHub.mirror.drawer.pr', 'PR')} #${review.number}`}
        action={
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-foreground">
            {stateLabel(review.state)}
          </span>
        }
      />
      <DrawerRow
        trail={
          <DrawerLink onClick={() => openUrl(review.url)}>
            <ExternalLink
              className="size-3"
              aria-label={translate('agentHub.mirror.drawer.openPr', 'Open on the host')}
            />
          </DrawerLink>
        }
        title={review.title}
      >
        {review.title}
      </DrawerRow>
      {summary && summary.passed > 0 ? (
        <DrawerRow lead={<span className="size-2 rounded-full bg-status-success" />}>
          {translate('agentHub.mirror.drawer.checksPassed', '{{count}} checks passed', {
            count: summary.passed,
            defaultValue_one: '{{count}} check passed'
          })}
        </DrawerRow>
      ) : null}
      {summary && summary.pending > 0 ? (
        <DrawerRow lead={<span className="size-2 rounded-full bg-muted-foreground" />}>
          {translate('agentHub.mirror.drawer.checksPending', '{{count}} checks running', {
            count: summary.pending,
            defaultValue_one: '{{count}} check running'
          })}
        </DrawerRow>
      ) : null}
      {failedChecks.map((check) => (
        <DrawerRow
          key={check.name}
          lead={<span className="size-2 rounded-full bg-destructive" />}
          title={check.name}
          trail={
            <>
              <span className="text-xs text-destructive">
                {translate('agentHub.mirror.drawer.checkFailed', 'failed')}
              </span>
              {check.url ? (
                <DrawerLink onClick={() => openUrl(check.url ?? review.url)}>
                  {translate('agentHub.mirror.drawer.checkLog', 'Log')}
                </DrawerLink>
              ) : null}
              {actions.rerunFailed ? (
                <DrawerLink onClick={actions.rerunFailed} disabled={actions.rerunning}>
                  {translate('agentHub.mirror.drawer.rerun', 'Rerun')}
                </DrawerLink>
              ) : null}
              <DrawerLink onClick={() => actions.draftChecks([check])}>
                {translate('agentHub.mirror.drawer.sendToAgent', 'Send to agent')}
              </DrawerLink>
            </>
          }
        >
          {check.name}
        </DrawerRow>
      ))}
      {threads.length > 0 ? (
        <DrawerSection
          label={translate('agentHub.mirror.drawer.reviewComments', 'Review')}
          count={threads.length}
        />
      ) : null}
      {threads.map((group) => {
        const { author, line } = threadFirstLine(group)
        return (
          <DrawerRow
            key={group.threadId}
            title={`${author}: ${line}`}
            trail={
              <DrawerLink onClick={() => actions.draftThread(group)}>
                {translate('agentHub.mirror.drawer.sendToAgent', 'Send to agent')}
              </DrawerLink>
            }
          >
            <span className="font-medium">{author}</span> {line}
          </DrawerRow>
        )
      })}
      {review.state === 'open' || review.state === 'draft' ? (
        <div className="flex items-center gap-2 p-2">
          <DrawerLink onClick={openMerge}>
            {translate('agentHub.mirror.drawer.merge', 'Merge…')}
          </DrawerLink>
        </div>
      ) : null}
    </>
  )
}
