import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import { getActivityThreadWorkspaceTitle } from '@/lib/activity-thread-display'
import { QuickLaunchAgentMenuItems } from '../tab-bar/QuickLaunchButton'

export function AgentHubMirrorNewAgent({
  worktree,
  workspaceHeader = false,
  pending,
  onStart
}: {
  worktree: Worktree
  workspaceHeader?: boolean
  pending: boolean
  onStart: (worktree: Worktree, agent: TuiAgent) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const workspace = getActivityThreadWorkspaceTitle(worktree)
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <span
        className={
          workspaceHeader
            ? 'opacity-0 group-hover/workspace:opacity-100 group-focus-within/workspace:opacity-100 data-[expanded=true]:opacity-100'
            : undefined
        }
        data-expanded={open}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant={workspaceHeader ? 'ghost' : 'outline'}
            size="xs"
            disabled={pending}
            aria-label={
              workspaceHeader
                ? translate('agentHub.mirror.addAgentInWorkspace', 'Add agent in {{workspace}}', {
                    workspace
                  })
                : undefined
            }
          >
            <Plus />
            {workspaceHeader
              ? translate('agentHub.mirror.agent', 'agent')
              : translate('agentHub.mirror.newAgent', 'New agent')}
          </Button>
        </DropdownMenuTrigger>
      </span>
      <DropdownMenuContent
        align="start"
        onKeyDown={(event) => event.stopPropagation()}
        onEscapeKeyDown={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          if (pending) {
            event.preventDefault()
          }
        }}
      >
        <QuickLaunchAgentMenuItems
          worktreeId={worktree.id}
          disabled={pending}
          onLaunch={(agent) => {
            onStart(worktree, agent)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
