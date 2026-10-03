import { CheckCheck, PictureInPicture2, SquareArrowOutUpRight, SquareTerminal } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { threadAgentState } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'

function RowAction({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          // Why tabIndex -1: the list is driven by arrow keys; Tab switches hub tabs.
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** One agent or shell row; clicking it opens the live mirror, ↵ jumps to the pane. */
export function AgentHubRow({
  thread,
  agentType,
  title,
  subtitle,
  trailing,
  selected,
  indent = false,
  onPopout,
  onJump,
  onMarkRead
}: {
  thread: AgentPaneThread | null
  agentType: AgentPaneThread['agentType'] | null
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  selected: boolean
  indent?: boolean
  onPopout: () => void
  onJump: () => void
  onMarkRead?: () => void
}): React.JSX.Element {
  const agent = agentTypeToIconAgent(agentType)
  return (
    <div
      role="option"
      aria-selected={selected}
      data-selected={selected}
      data-agent-hub-row
      className="jump-palette-item group/row flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-accent data-[indent=true]:ml-3"
      data-indent={indent}
      onClick={onPopout}
    >
      <span className="flex w-3 shrink-0 justify-center">
        {thread ? <AgentStateDot state={threadAgentState(thread)} /> : null}
      </span>
      <span className="inline-flex shrink-0 text-muted-foreground">
        {agent ? <AgentIcon agent={agent} size={14} /> : <SquareTerminal className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        {subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground group-hover/row:hidden group-data-[selected=true]/row:hidden">
        {trailing}
      </span>
      <span className="hidden shrink-0 items-center gap-0.5 group-hover/row:flex group-data-[selected=true]/row:flex">
        {onMarkRead ? (
          <RowAction label={translate('agentHub.row.markRead', 'Mark read')} onClick={onMarkRead}>
            <CheckCheck className="size-3.5" />
          </RowAction>
        ) : null}
        <RowAction label={translate('agentHub.row.popOut', 'Pop out')} onClick={onPopout}>
          <PictureInPicture2 className="size-3.5" />
        </RowAction>
        <RowAction label={translate('agentHub.row.jump', 'Open in Orca')} onClick={onJump}>
          <SquareArrowOutUpRight className="size-3.5" />
        </RowAction>
      </span>
    </div>
  )
}
