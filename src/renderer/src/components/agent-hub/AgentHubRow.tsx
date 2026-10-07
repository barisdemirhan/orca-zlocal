import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { ArrowUpRight, CheckCheck } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { AgentType } from '../../../../shared/agent-status-types'
import { HubAvatar, HubStateIndicator, type AgentHubIndicatorKind } from './AgentHubAtoms'
import { HubRowAction, HubRowMirrorActions } from './AgentHubRowActions'

/** One agent or shell row: click opens the live mirror, ↵ jumps to the pane. */
export function AgentHubRow({
  kind,
  agentType,
  title,
  subtitle,
  snippet,
  chips,
  time,
  selected,
  indent = false,
  worktreeId,
  mirrorKey,
  mirrorTarget,
  onOpen,
  onPopout,
  onJump,
  onMarkRead
}: {
  kind: AgentHubIndicatorKind
  agentType: AgentType | null
  title: string
  subtitle?: React.ReactNode
  snippet?: string
  chips?: React.ReactNode
  time?: string
  selected: boolean
  indent?: boolean
  /** The row's workspace; a row in the one already on screen reads as quieter. */
  worktreeId?: string
  /** The pane's key among the mirrors (see agentHubPaneTargetKey). */
  mirrorKey: string
  mirrorTarget?: AgentHubPaneTarget
  /** A click on the row: opens the mirror and leaves the hub. */
  onOpen: () => void
  /** The pop-out button: opens the mirror and keeps the hub open for the next one. */
  onPopout: () => void
  onJump: () => void
  onMarkRead?: () => void
}): React.JSX.Element {
  const current = useAppStore(
    (s) =>
      worktreeId !== undefined && s.activeView === 'terminal' && s.activeWorktreeId === worktreeId
  )
  return (
    <div
      role="option"
      aria-selected={selected}
      data-selected={selected}
      data-indent={indent}
      data-current={current}
      data-agent-hub-row
      title={
        current
          ? translate('agentHub.row.currentWorkspace', 'In the workspace you have open')
          : undefined
      }
      className="jump-palette-item group/row flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-transparent px-2 py-[7px] transition-opacity hover:bg-foreground/[0.03] data-[current=true]:opacity-55 data-[indent=true]:ml-3.5 data-[current=true]:hover:opacity-100 data-[current=true]:data-[selected=true]:opacity-100"
      onClick={onOpen}
    >
      <span className="grid w-3 shrink-0 place-items-center">
        <HubStateIndicator kind={kind} />
      </span>
      <HubAvatar agentType={agentType} kind={agentType ? kind : null} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[11.5px] text-muted-foreground">{subtitle}</span>
        ) : null}
        {snippet ? (
          <span className="block truncate text-[11.5px] text-muted-foreground/70">“{snippet}”</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted-foreground/70">
        {chips}
        {time ? (
          <span className="group-hover/row:hidden group-data-[selected=true]/row:hidden">
            {time}
          </span>
        ) : null}
        <span className="hidden gap-0.5 group-hover/row:flex group-data-[selected=true]/row:flex">
          {onMarkRead ? (
            <HubRowAction
              label={translate('agentHub.row.markRead', 'Mark read')}
              onClick={onMarkRead}
            >
              <CheckCheck className="size-[13px]" />
            </HubRowAction>
          ) : null}
          <HubRowMirrorActions mirrorKey={mirrorKey} target={mirrorTarget} onPopout={onPopout} />
          <HubRowAction
            label={translate('agentHub.row.jump', 'Jump to this terminal')}
            onClick={onJump}
          >
            <ArrowUpRight className="size-[13px]" />
          </HubRowAction>
        </span>
      </span>
    </div>
  )
}
