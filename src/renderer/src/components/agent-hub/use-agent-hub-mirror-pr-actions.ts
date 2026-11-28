import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { codeHostErrorText } from '@/lib/source-control/remote/code-host-error-copy'
import { rerunPullRequestChecksRequest } from '@/lib/source-control/checks/rerun-pull-request-checks'
import {
  getGitHubSourceTarget,
  getGitHubWorkItemRequestContext
} from '@/store/github/work-items/work-item-routing'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import type { PRComment } from '../../../../shared/github/comments/comment-types'
import { buildFixBrokenChecksPrompt } from '../../../../shared/source-control/checks/pr-checks-fix-prompt'
import {
  getPRCommentGroupRoot,
  groupPRComments,
  isResolvedPRCommentGroup,
  type PRCommentGroup
} from '../../../../shared/source-control/review-comments/pr-comment-groups'
import { buildPRCommentsResolutionPrompt } from '../../../../shared/source-control/review-comments/pr-comments-resolution-prompt'
import type { MirrorReview } from './agent-hub-mirror-card-facts'
import type { Repo } from '../../../../shared/repository/repo-types'
import { draftTextForMirrorAgent } from './agent-hub-mirror-send-to-agent'

/** What the PR drawer needs of its card: where its agent is and which repo the PR lives in. */
export type MirrorPrContext = {
  worktreeId: string
  worktreePath: string
  tabId: string
  repo: Repo | null
}

type ThreadGroup = Extract<PRCommentGroup, { kind: 'thread' }>

/** Unresolved review threads of a GitHub PR, read through the store's cached comments fetch. */
export function useAgentHubMirrorReviewThreads(
  card: MirrorPrContext,
  review: MirrorReview['review'],
  enabled: boolean
): ThreadGroup[] {
  const [comments, setComments] = useState<readonly PRComment[]>([])
  const fetchPRComments = useAppStore((s) => s.fetchPRComments)
  const { repo } = card
  const isGitHub = review.provider === 'github'
  useEffect(() => {
    if (!enabled || !isGitHub || !repo) {
      return
    }
    let current = true
    void fetchPRComments(repo.path, review.number, {
      repoId: repo.id,
      repoOwnerExecutionHostId: getRepoExecutionHostId(repo),
      prRepo: review.githubRepository ?? null
    })
      .then((result) => current && setComments(result))
      .catch(() => current && setComments([]))
    return () => {
      current = false
    }
  }, [enabled, isGitHub, repo, review.number, review.githubRepository, fetchPRComments])
  return useMemo(
    () =>
      groupPRComments(comments).filter(
        (group): group is ThreadGroup => group.kind === 'thread' && !isResolvedPRCommentGroup(group)
      ),
    [comments]
  )
}

export function threadFirstLine(group: ThreadGroup): { author: string; line: string } {
  const root = getPRCommentGroupRoot(group)
  return { author: root.author, line: root.body.trim().split('\n')[0] ?? '' }
}

function notifyDrafted(drafted: boolean): void {
  if (drafted) {
    toast.success(translate('agentHub.mirror.drawer.drafted', 'Added to the agent draft'))
  } else {
    toast.info(
      translate('agentHub.mirror.drawer.draftFailed', 'This agent cannot take a draft right now')
    )
  }
}

/** Rerun, and the Send to agent drafts, of one card's PR drawer. */
export function useAgentHubMirrorPrActions(
  card: MirrorPrContext,
  review: MirrorReview['review']
): {
  rerunFailed: (() => void) | null
  rerunning: boolean
  draftChecks: (checks: MirrorReview['failedChecks']) => void
  draftThread: (group: ThreadGroup) => void
} {
  const [rerunning, setRerunning] = useState(false)
  const { repo } = card
  const canRerun = review.provider === 'github' && repo != null && review.headSha !== undefined
  const rerunFailed = useCallback(() => {
    if (!repo || rerunning) {
      return
    }
    const state = useAppStore.getState()
    const context = getGitHubWorkItemRequestContext(
      state,
      getGitHubSourceTarget(state, repo),
      repo.id,
      repo.path
    )
    const prRepo = review.githubRepository ?? null
    setRerunning(true)
    void rerunPullRequestChecksRequest({
      target: context.target,
      repoId: repo.id,
      repoPath: repo.path,
      prNumber: review.number,
      headSha: review.headSha,
      prRepo,
      failedOnly: true
    })
      .then(async (result) => {
        if (!result.ok) {
          toast.error(codeHostErrorText(result))
          return
        }
        toast.success(translate('agentHub.mirror.drawer.rerunRequested', 'Rerun requested'))
        await state.fetchPRChecks(repo.path, review.number, undefined, review.headSha, prRepo, {
          repoId: repo.id,
          repoOwnerExecutionHostId: getRepoExecutionHostId(repo),
          force: true,
          userRefresh: true
        })
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : String(error))
      })
      .finally(() => setRerunning(false))
  }, [repo, review, rerunning])
  const draftChecks = useCallback(
    (checks: MirrorReview['failedChecks']) => {
      const prompt = buildFixBrokenChecksPrompt({
        reviewNumber: review.number,
        reviewTitle: review.title,
        reviewUrl: review.url,
        checks: [...checks]
      })
      void draftTextForMirrorAgent(card, prompt).then(notifyDrafted, () => notifyDrafted(false))
    },
    [card, review]
  )
  const draftThread = useCallback(
    (group: ThreadGroup) => {
      const prompt = buildPRCommentsResolutionPrompt({
        reviewKind: 'PR',
        reviewNumber: review.number,
        reviewTitle: review.title,
        reviewUrl: review.url,
        groups: [group],
        worktreePath: card.worktreePath
      })
      void draftTextForMirrorAgent(card, prompt).then(notifyDrafted, () => notifyDrafted(false))
    },
    [card, review]
  )
  return { rerunFailed: canRerun ? rerunFailed : null, rerunning, draftChecks, draftThread }
}
