import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import { getActivityThreadWorkspaceTitle } from '@/lib/workspace/activity/activity-thread-display'
import { QuickLaunchAgentMenuItems } from '../tab-bar/QuickLaunchButton'

export type AgentHubMirrorNewAgentProps = {
  worktree: Worktree
  workspaceHeader?: boolean
  pending: boolean
  onStart: (worktree: Worktree, agent: TuiAgent) => void
  onOpenDialog?: (worktree: Worktree) => void
}

export function AgentHubMirrorNewAgent({
  worktree,
  workspaceHeader = false,
  pending,
  onStart,
  onOpenDialog
}: AgentHubMirrorNewAgentProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  if (!workspaceHeader) {
    return (
      <Button
        variant="outline"
        size="xs"
        disabled={pending}
        onClick={() => onOpenDialog?.(worktree)}
      >
        <Plus />
        {translate('agentHub.mirror.newAgent', 'New agent')}
      </Button>
    )
  }
  const workspace = getActivityThreadWorkspaceTitle(worktree)
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <span
        className="opacity-0 group-hover/workspace:opacity-100 group-focus-within/workspace:opacity-100 data-[expanded=true]:opacity-100"
        data-expanded={open}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            disabled={pending}
            aria-label={translate(
              'agentHub.mirror.addAgentInWorkspace',
              'Add agent in {{workspace}}',
              {
                workspace
              }
            )}
          >
            <Plus />
            {translate('agentHub.mirror.agent', 'agent')}
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
            setOpen(false)
            onStart(worktree, agent)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
