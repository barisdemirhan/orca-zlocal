import { toast } from 'sonner'
import type { GitHubRuntimeHost } from '@/lib/work-items/github/github-source-runtime-context'
import {
  rerunPullRequestChecksRequest,
  rerunTargetForRuntimeHost
} from '@/lib/source-control/checks/rerun-pull-request-checks'
import { translate } from '@/i18n/i18n'
import type { GitHubRepositoryIdentity as GitHubOwnerRepo } from '../../../../../shared/github/repositories/repository-identity'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import type { PRCheckDetail } from '../../../../../shared/github/checks/check-types'
import type { TaskSourceContext } from '../../../../../shared/work-items/task-source-context'
import type { GitHubChecksTabState } from '../../github/github-checks-tab-state'
import { codeHostErrorText } from '@/lib/source-control/remote/code-host-error-copy'

/** The checks tab mints one of these per context; only its reference identity is ever read. */
type ChecksContextOwner = GitHubChecksTabState['contextOwner']

export async function rerunPullRequestChecks(args: {
  canUseChecksRepoContext: boolean
  rerunning: boolean
  committedChecksContextOwnerRef: { current: ChecksContextOwner }
  setRerunningOwner: (
    value:
      | ChecksContextOwner
      | null
      | ((current: ChecksContextOwner | null) => ChecksContextOwner | null)
  ) => void
  runtimeHost: GitHubRuntimeHost | null
  sourceContext?: TaskSourceContext | null
  repoId: string | null
  repoPath: string | null
  item: GitHubWorkItem
  headSha: string | undefined
  prRepo: GitHubOwnerRepo | null
  failedOnly: boolean
  mountedRef: { current: boolean }
  handleRefresh: (expectedContextOwner?: ChecksContextOwner) => Promise<PRCheckDetail[] | null>
}): Promise<void> {
  if (!args.canUseChecksRepoContext || args.rerunning) {
    return
  }
  const rerunContextOwner = args.committedChecksContextOwnerRef.current
  args.setRerunningOwner(rerunContextOwner)
  try {
    const result = await rerunPullRequestChecksRequest({
      target: rerunTargetForRuntimeHost(
        args.runtimeHost,
        args.sourceContext,
        args.repoId ?? args.item.repoId
      ),
      sourceContext: args.sourceContext,
      repoId: args.repoId,
      repoPath: args.repoPath,
      prNumber: args.item.number,
      headSha: args.headSha,
      failedOnly: args.failedOnly,
      prRepo: args.prRepo
    })
    if (
      !args.mountedRef.current ||
      args.committedChecksContextOwnerRef.current !== rerunContextOwner
    ) {
      return
    }
    if (!result.ok) {
      toast.error(codeHostErrorText(result))
      return
    }
    toast.success(
      result.count === 1
        ? translate('auto.components.PullRequestPage.5963a6a852', 'Check rerun requested')
        : translate('auto.components.PullRequestPage.18f2af42ac', 'Check reruns requested')
    )
    await args.handleRefresh(rerunContextOwner)
  } catch (err) {
    if (
      args.mountedRef.current &&
      args.committedChecksContextOwnerRef.current === rerunContextOwner
    ) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate('auto.components.PullRequestPage.788a782bb0', 'Failed to rerun checks')
      )
    }
  } finally {
    if (args.mountedRef.current) {
      args.setRerunningOwner((current) => (current === rerunContextOwner ? null : current))
    }
  }
}
