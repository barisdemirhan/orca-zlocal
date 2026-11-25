import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { isGitRepoKind } from '../../../../shared/repository/repo-kind'
import type { GitStatusEntry } from '../../../../shared/git/status/git-status-types'
import type { PRCheckDetail } from '../../../../shared/github/checks/check-types'
import type { HostedReviewInfo } from '../../../../shared/source-control/hosted-review/hosted-review-contracts'
import type { AgentChildRowModel } from '../../../../shared/agent-status/presentation/agent-child-row-model'
import { getWorktreeReviewCacheKeys } from '../sidebar/workspace-card/review/worktree-card-pr-derivation'
import { selectChecksPanelReview } from '../right-sidebar/checks-panel/review-state/checks-panel-review'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { agentHubChildRows, type AgentHubLineage } from './agent-hub-lineage'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export type MirrorWork = {
  subagents: readonly AgentChildRowModel[]
  commands: readonly AgentChildRowModel[]
  workers: readonly AgentPaneThread[]
  running: number
}

/** What an agent has running beneath it, from the status rows the hub already reads. */
export function mirrorWork(
  thread: AgentPaneThread | null,
  lineage: AgentHubLineage,
  now: number
): MirrorWork {
  if (!thread) {
    return { subagents: [], commands: [], workers: [], running: 0 }
  }
  const rows = agentHubChildRows(thread, now).filter((row) => !row.settled)
  const subagents = rows.filter((row) => row.kind === 'agent')
  const commands = rows.filter((row) => row.kind === 'command')
  const workers = lineage.childrenOf(thread.paneKey).workers
  const busyWorkers = workers.filter((worker) => agentHubIndicatorKind(worker) === 'work')
  return {
    subagents,
    commands,
    workers,
    running: subagents.length + commands.length + busyWorkers.length
  }
}

export type MirrorChanges = {
  entries: readonly GitStatusEntry[]
  added: number
  removed: number
}

/** The working tree already loaded for this workspace; null for a folder or before the first load. */
export function useAgentHubMirrorChanges(target: AgentHubPaneTarget): MirrorChanges | null {
  const gitCapable = target.repo !== null && isGitRepoKind(target.repo)
  const entries = useAppStore((s) =>
    gitCapable ? s.gitStatusByWorktree[target.worktree.id] : undefined
  )
  return useMemo(() => {
    if (!entries) {
      return null
    }
    let added = 0
    let removed = 0
    for (const entry of entries) {
      added += entry.added ?? 0
      removed += entry.removed ?? 0
    }
    return { entries, added, removed }
  }, [entries])
}

export type MirrorReview = {
  review: HostedReviewInfo
  failedChecks: readonly PRCheckDetail[]
}

const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'cancelled', 'action_required'])

/** The PR the review caches already hold for this branch; nothing is fetched from here. */
export function useAgentHubMirrorReview(target: AgentHubPaneTarget): MirrorReview | null {
  const settings = useAppStore((s) => s.settings)
  const repo = target.repo ?? undefined
  const keys = getWorktreeReviewCacheKeys(target.worktree, repo, settings)
  const hostedReview = useAppStore((s) => s.hostedReviewCache?.[keys.hostedReviewCacheKey]?.data)
  const pr = useAppStore((s) => s.prCache?.[keys.prCacheKey]?.data)
  const checksCache = useAppStore((s) => s.checksCache)
  const { worktree } = target
  return useMemo(() => {
    const review = selectChecksPanelReview({
      hostedReview,
      pr,
      linkedPR: worktree.linkedPR ?? null,
      suppressedGitHubPR: worktree.suppressedGitHubPR ?? null,
      linkedGitLabMR: worktree.linkedGitLabMR ?? null,
      linkedBitbucketPR: worktree.linkedBitbucketPR ?? null,
      linkedAzureDevOpsPR: worktree.linkedAzureDevOpsPR ?? null,
      linkedGiteaPR: worktree.linkedGiteaPR ?? null
    })
    if (!review) {
      return null
    }
    const failedChecks = review.headSha
      ? Object.values(checksCache)
          .filter((entry) => entry.headSha === review.headSha)
          .flatMap((entry) => entry.data ?? [])
          .filter((check) => check.conclusion !== null && FAILED_CONCLUSIONS.has(check.conclusion))
      : []
    return { review, failedChecks }
  }, [hostedReview, pr, checksCache, worktree])
}

export function reviewFailedCount(review: HostedReviewInfo): number {
  return review.checksSummary?.failed ?? 0
}
