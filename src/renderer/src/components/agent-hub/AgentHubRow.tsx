import { AgentHubPaneSleepAction } from './AgentHubPaneSleepAction'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { ArrowUpRight, CheckCheck, PanelBottom, PictureInPicture2, Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import { HubAvatar, HubStateIndicator } from './AgentHubStateMarks'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import { HubRowAction, HubRowCloseAgent, HubRowMirrorActions } from './AgentHubRowActions'
import { useAgentHubProgress } from './use-agent-hub-progress'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { useAgentHubMirrors } from './agent-hub-mirror-store'

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
  optionId,
  indent = false,
  worktreeId,
  mirrorKey,
  mirrorTarget,
  onOpen,
  onPopout,
  onJump,
  onMarkRead,
  onClose,
  selectionMode = false,
  sleeping = false
}: {
  kind: AgentHubIndicatorKind
  agentType: AgentType | null
  title: string
  subtitle?: React.ReactNode
  snippet?: string
  chips?: React.ReactNode
  time?: string
  selected: boolean
  optionId?: string
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
  /** Ends the row's agent and closes its pane; absent hides the button. */
  onClose?: () => void
  selectionMode?: boolean
  sleeping?: boolean
}): React.JSX.Element {
  const progress = useAgentHubProgress(mirrorTarget)
  const presence = findAgentHubMirrorMembership(
    useAgentHubMirrors(),
    mirrorTarget ?? mirrorKey
  )?.presence
  const current = useAppStore(
    (s) =>
      worktreeId !== undefined && s.activeView === 'terminal' && s.activeWorktreeId === worktreeId
  )
  return (
    <div
      role="option"
      id={optionId}
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
      className="jump-palette-item group/row relative flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 transition-opacity hover:bg-foreground/[0.03] data-[current=true]:opacity-55 data-[indent=true]:ml-3.5 data-[current=true]:hover:opacity-100 data-[current=true]:data-[selected=true]:opacity-100"
      onClick={onOpen}
    >
      {presence ? (
        <span
          aria-hidden
          data-presence={presence}
          className="absolute inset-y-[7px] -left-[3px] w-[2.5px] rounded-full bg-[var(--terminal-pane-locate)] data-[presence=chip]:opacity-35"
        />
      ) : null}
      <span className="grid w-3 shrink-0 place-items-center">
        <HubStateIndicator kind={kind} />
      </span>
      <HubAvatar agentType={agentType} kind={agentType ? kind : null} sleeping={sleeping} />
      <span className="min-w-0 flex-1">
        <span
          data-sleeping={sleeping}
          className="block truncate text-[13px] font-medium data-[sleeping=true]:opacity-60"
        >
          {title}
        </span>
        {progress || subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">
            {progress ?? subtitle}
          </span>
        ) : null}
        {snippet ? (
          <span className="block truncate text-xs text-muted-foreground/70">“{snippet}”</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted-foreground/70">
        {chips}
        {!selectionMode && mirrorTarget ? (
          <AgentHubPaneSleepAction target={mirrorTarget} appearance="row" />
        ) : null}
        {presence ? (
          <span
            data-presence={presence}
            title={
              presence === 'chip'
                ? translate('agentHub.row.mirrorInDock', 'Mirror is in the dock')
                : translate('agentHub.row.mirrorOpen', 'Mirror is open')
            }
            className="text-[var(--terminal-pane-locate)] group-hover/row:hidden group-data-[selected=true]/row:hidden data-[presence=chip]:opacity-60"
          >
            {presence === 'chip' ? (
              <PanelBottom className="size-3" />
            ) : (
              <PictureInPicture2 className="size-3" />
            )}
          </span>
        ) : null}
        {time ? (
          <span className="group-hover/row:hidden group-data-[selected=true]/row:hidden">
            {time}
          </span>
        ) : null}
        <span className="hidden gap-0.5 group-hover/row:flex group-data-[selected=true]/row:flex">
          {selectionMode ? (
            <HubRowAction label={translate('agentHub.mirror.add', 'Add terminal')} onClick={onOpen}>
              <Plus className="size-3.5" />
            </HubRowAction>
          ) : (
            <>
              {onMarkRead ? (
                <HubRowAction
                  label={translate('agentHub.row.markRead', 'Mark read')}
                  onClick={onMarkRead}
                >
                  <CheckCheck className="size-3.5" />
                </HubRowAction>
              ) : null}
              <HubRowMirrorActions
                mirrorKey={mirrorKey}
                target={mirrorTarget}
                onPopout={onPopout}
              />
              <HubRowAction
                label={translate('agentHub.row.jump', 'Jump to this terminal')}
                onClick={onJump}
              >
                <ArrowUpRight className="size-3.5" />
              </HubRowAction>
              {onClose ? <HubRowCloseAgent isAgent={agentType !== null} onClose={onClose} /> : null}
            </>
          )}
        </span>
      </span>
    </div>
  )
}
