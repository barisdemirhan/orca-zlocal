import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { getGitHubRuntimeRepoId } from '@/lib/work-items/github/github-source-runtime-context'
import type { GitHubWorkItemRequestTarget } from '@/store/github/work-items/work-item-routing'
import type { GitHubRerunPRChecksResult } from '../../../../../shared/github/checks/check-types'
import type { GitHubRepositoryIdentity as GitHubOwnerRepo } from '../../../../../shared/github/repositories/repository-identity'
import type { TaskSourceContext } from '../../../../../shared/work-items/task-source-context'

export type RerunPullRequestChecksRequest = {
  target: GitHubWorkItemRequestTarget
  sourceContext?: TaskSourceContext | null
  repoId: string | null
  repoPath: string | null
  prNumber: number
  headSha: string | undefined
  prRepo: GitHubOwnerRepo | null
  failedOnly: boolean
}

/** The runtime target a PR surface already holds, as the request target the rerun routes by. */
export function rerunTargetForRuntimeHost(
  runtimeHost: { environmentId: string } | null,
  sourceContext: TaskSourceContext | null | undefined,
  repoId: string
): GitHubWorkItemRequestTarget {
  return runtimeHost
    ? {
        kind: 'environment',
        environmentId: runtimeHost.environmentId,
        runtimeRepoId: getGitHubRuntimeRepoId(sourceContext, repoId)
      }
    : { kind: 'local' }
}

/** The rerun request itself, over the runtime RPC or the local bridge; callers own toasts and refresh. */
export function rerunPullRequestChecksRequest(
  request: RerunPullRequestChecksRequest
): Promise<GitHubRerunPRChecksResult> {
  if (request.target.kind === 'environment') {
    return callRuntimeRpc<GitHubRerunPRChecksResult>(
      { kind: 'environment', environmentId: request.target.environmentId },
      'github.rerunPRChecks',
      {
        repo: request.target.runtimeRepoId,
        prNumber: request.prNumber,
        headSha: request.headSha,
        failedOnly: request.failedOnly,
        prRepo: request.prRepo
      },
      { timeoutMs: 30_000 }
    )
  }
  return window.api.gh.rerunPRChecks({
    repoPath: request.repoPath ?? '',
    repoId: request.repoId ?? undefined,
    sourceContext: request.sourceContext,
    prNumber: request.prNumber,
    headSha: request.headSha,
    failedOnly: request.failedOnly,
    prRepo: request.prRepo
  })
}
