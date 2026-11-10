import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { branchDisplayName } from '@/components/sidebar/workspace-card/identity/worktree-branch-display'
import { COMBOBOX_POPOVER_SURFACE } from '@/components/new-workspace/type-ahead-combobox-styles'
import { translate } from '@/i18n/i18n'
import { getActivityThreadWorkspaceTitle } from '@/lib/activity-thread-display'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { getIndexedRepoMap } from '@/store/repos/repository-catalog-index'
import { getWorktreeExecutionHostId } from '../../../../shared/execution-host'
import {
  getWorktreeHostIdentity,
  type HostScopedWorktreeKey
} from '../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../shared/worktree/types'

function WorkspaceLabel({ worktree }: { worktree: Worktree }): React.JSX.Element {
  const host = useAppStore((state) => {
    const hostId = getWorktreeExecutionHostId(
      worktree,
      getIndexedRepoMap(state.repos).get(worktree.repoId)
    )
    return hostId === 'local'
      ? null
      : selectExecutionHostDisplayLabel(state, hostId, {
          sshEnvironmentId: worktree.runtimeOwnerEnvironmentId
        })
  })
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span className="truncate">{getActivityThreadWorkspaceTitle(worktree)}</span>
      {worktree.branch ? (
        <span className="truncate text-xs text-muted-foreground">
          {branchDisplayName(worktree.branch)}
        </span>
      ) : null}
      {host ? <span className="ml-auto truncate text-xs text-muted-foreground">{host}</span> : null}
    </span>
  )
}

export function AgentHubNewAgentWorkspaceCombobox({
  worktrees,
  value,
  onValueChange,
  disabled
}: {
  worktrees: readonly Worktree[]
  value: HostScopedWorktreeKey
  onValueChange: (identity: HostScopedWorktreeKey) => void
  disabled: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = worktrees.find((row) => getWorktreeHostIdentity(row) === value)
  const label = translate('agentHub.mirror.workspace', 'Workspace')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between border-input px-3 text-sm font-normal text-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        >
          {selected ? (
            <WorkspaceLabel worktree={selected} />
          ) : (
            translate('agentHub.mirror.chooseWorkspace', 'Choose workspace')
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          'flex w-[var(--radix-popover-trigger-width)] min-w-[17rem] flex-col p-0',
          COMBOBOX_POPOVER_SURFACE
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          const content = event.currentTarget
          if (content instanceof HTMLElement) {
            content.querySelector<HTMLInputElement>('[data-slot="command-input"]')?.focus()
          }
        }}
      >
        <Command>
          <CommandInput
            aria-label={translate('agentHub.mirror.searchWorkspaces', 'Search workspaces')}
            placeholder={translate('agentHub.mirror.searchWorkspaces', 'Search workspaces')}
          />
          <CommandList>
            <CommandEmpty>
              {translate('agentHub.mirror.noWorkspaces', 'No matching workspaces.')}
            </CommandEmpty>
            {worktrees.map((worktree) => {
              const identity = getWorktreeHostIdentity(worktree)
              return (
                <CommandItem
                  key={identity}
                  value={identity}
                  keywords={[
                    getActivityThreadWorkspaceTitle(worktree),
                    worktree.branch,
                    worktree.path
                  ]}
                  onSelect={() => {
                    onValueChange(identity)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-3.5 shrink-0', value !== identity && 'opacity-0')} />
                  <WorkspaceLabel worktree={worktree} />
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
