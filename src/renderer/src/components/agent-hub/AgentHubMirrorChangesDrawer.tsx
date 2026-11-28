import { PencilLine } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { sourceControlScopeRuntimeEnvironmentId } from '../right-sidebar/source-control/panel/worktree-scope'
import { openUncommittedEntry } from '../right-sidebar/source-control/listing/open-uncommitted-entry'
import type { MirrorChanges } from './agent-hub-mirror-card-facts'
import { DrawerLink, DrawerNote, DrawerRow, DrawerSection } from './AgentHubMirrorDrawerParts'

type DiffOptions = Parameters<ReturnType<typeof useAppStore.getState>['openDiff']>[5]

/** The same host fields the source-control panel's scope passes, so paired-host and SSH diffs read the right files. */
function useMirrorDiffOptions(worktreeId: string): DiffOptions {
  const worktree = useAppStore((s) => {
    for (const list of Object.values(s.worktreesByRepo)) {
      const found = list.find((candidate) => candidate.id === worktreeId)
      if (found) {
        return found
      }
    }
    return null
  })
  const repo = useAppStore((s) => s.repos.find((candidate) => candidate.id === worktree?.repoId))
  if (!worktree || !repo) {
    return {}
  }
  const executionHostId = getRepoExecutionHostId(repo)
  const runtimeEnvironmentId = sourceControlScopeRuntimeEnvironmentId({
    worktreeId,
    repoId: repo.id,
    executionHostId,
    placementWorkspaceId: worktreeId,
    connectionId: repo.connectionId ?? null,
    runtimeOwnerEnvironmentId: worktree.runtimeOwnerEnvironmentId
  })
  return { executionHostId, runtimeEnvironmentId }
}

/** The working tree the source-control store already holds; opening goes through its own diff views. */
export function AgentHubMirrorChangesDrawer({
  worktree,
  changes
}: {
  worktree: { id: string; path: string }
  changes: MirrorChanges
}): React.JSX.Element {
  const options = useMirrorDiffOptions(worktree.id)
  if (changes.entries.length === 0) {
    return (
      <DrawerNote>
        {translate('agentHub.mirror.drawer.changesEmpty', 'No uncommitted changes.')}
      </DrawerNote>
    )
  }
  return (
    <>
      <DrawerSection
        label={translate('agentHub.mirror.drawer.changes', 'Changes')}
        count={changes.entries.length}
        action={
          <DrawerLink
            onClick={() =>
              useAppStore
                .getState()
                .openAllDiffs(
                  worktree.id,
                  worktree.path,
                  undefined,
                  undefined,
                  [...changes.entries],
                  options
                )
            }
          >
            {translate('agentHub.mirror.drawer.openAll', 'Open all')}
          </DrawerLink>
        }
      />
      {changes.entries.map((entry) => (
        <DrawerRow
          key={`${entry.area}:${entry.path}`}
          lead={<PencilLine className="size-3.5 shrink-0 text-muted-foreground" />}
          title={entry.path}
          trail={
            <>
              {entry.added !== undefined ? (
                <span className="font-mono text-[11px] text-status-success">+{entry.added}</span>
              ) : null}
              {entry.removed !== undefined ? (
                <span className="font-mono text-[11px] text-destructive">−{entry.removed}</span>
              ) : null}
              <DrawerLink
                onClick={() =>
                  openUncommittedEntry(
                    useAppStore.getState(),
                    worktree.id,
                    worktree.path,
                    entry,
                    options
                  )
                }
              >
                {translate('agentHub.mirror.drawer.openDiff', 'Open diff')}
              </DrawerLink>
            </>
          }
        >
          {entry.path.split('/').at(-1)}
        </DrawerRow>
      ))}
    </>
  )
}
