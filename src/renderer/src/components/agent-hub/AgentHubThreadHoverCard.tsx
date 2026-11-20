import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { ArrowUpRight, Crosshair, PictureInPicture2, Plus } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useNow } from '@/lib/window-activity/use-now'
import { translate } from '@/i18n/i18n'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import {
  activityThreadRowCopy,
  threadAgentStateLabel
} from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { HubAvatar, HubStateIndicator } from './AgentHubStateMarks'
import { HubChip, HubCrumb } from './AgentHubInlineLabels'
import { agentHubIndicatorKind, agentHubStateSince, agentHubToolName } from './agent-hub-lists'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'
import { useClaudeSessionModel } from './use-claude-session-model'

export type AgentHubThreadCardActions = {
  /** Present when the agent is on screen nowhere: in no window and not in the workspace. */
  onJump?: () => void
  /** Present when the agent has no window of its own yet. */
  onPopout?: () => void
  onOpenTab?: () => void
  /** Opens the sidebar on the agent's workspace. */
  onShowInSidebar?: () => void
  /** Names the jump-to-mirror shortcut on Jump; only the active mirror tab's Jump has it. */
  showJumpShortcut?: boolean
}

function Detail({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="min-w-0 text-foreground/90">{children}</dd>
    </>
  )
}

/**
 * A light card for one agent: which agent and model, what it is doing, and where it runs.
 * Why not the Activity card: that one loads the workspace's review and issue details, too much
 * for a strip of tabs hovered in passing.
 */
export function AgentHubThreadHoverCard({
  thread,
  target,
  location,
  actions,
  hint,
  suppressed = false,
  children
}: {
  thread: AgentPaneThread | null
  target?: Pick<AgentHubPaneTarget, 'title' | 'agentType'>
  location: AgentHubLocation
  actions?: AgentHubThreadCardActions
  hint?: string
  /** Keeps the card shut while the trigger is busy (a drag, a rename). */
  suppressed?: boolean
  children: React.ReactElement
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <HoverCard openDelay={350} closeDelay={80} open={open && !suppressed} onOpenChange={setOpen}>
      {/* Pressing the trigger is a commitment to it; the card would only sit on top. */}
      <HoverCardTrigger asChild onPointerDown={() => setOpen(false)}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-72">
        <ThreadDetails thread={thread} target={target} location={location} actions={actions} />
        {hint ? <p className="mt-2.5 text-xs text-muted-foreground">{hint}</p> : null}
      </HoverCardContent>
    </HoverCard>
  )
}

function ThreadDetails({
  thread,
  target,
  location,
  actions
}: {
  thread: AgentPaneThread | null
  target?: Pick<AgentHubPaneTarget, 'title' | 'agentType'>
  location: AgentHubLocation
  actions?: AgentHubThreadCardActions
}): React.JSX.Element {
  const now = useNow(30_000)
  const kind = thread ? agentHubIndicatorKind(thread) : null
  const copy = thread ? activityThreadRowCopy(thread) : null
  const agentType = thread?.agentType ?? target?.agentType ?? null
  const entry = thread?.paneEntry ?? thread?.currentAgentEntry
  const reportedModel = entry?.model?.trim()
  const scannedModel = useClaudeSessionModel(
    agentType === 'claude' && !reportedModel ? (entry?.providerSession?.id ?? null) : null
  )
  const model = reportedModel || scannedModel
  const tool = thread && kind === 'work' ? agentHubToolName(thread) : null
  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="flex items-center gap-2.5">
        <HubAvatar agentType={agentType} kind={kind} />
        <div className="min-w-0">
          <div className="break-words text-[13px] font-semibold text-foreground">
            {copy?.taskTitle ?? target?.title}
          </div>
          <div className="truncate text-muted-foreground">
            {agentType ? formatAgentTypeLabel(agentType) : null}
            {model ? ` · ${model}` : ''}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {thread && kind ? (
          <Detail label={translate('agentHub.hover.state', 'State')}>
            {/* Wraps instead of running past the card when the state and tool are long. */}
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <HubStateIndicator kind={kind} />
              <span className="min-w-0">{threadAgentStateLabel(thread)}</span>
              <span className="text-muted-foreground/70">
                · {formatShortTimeAgo(agentHubStateSince(thread), now)}
              </span>
              {tool ? (
                <span className="max-w-full min-w-0 truncate">
                  <HubChip>{tool}</HubChip>
                </span>
              ) : null}
            </span>
          </Detail>
        ) : null}
        <Detail label={translate('agentHub.hover.where', 'Where')}>
          <span className="block min-w-0">
            <HubCrumb location={location} wrap />
          </span>
        </Detail>
      </dl>
      {/* A bare state name would repeat the State line above. */}
      {copy?.statusLine && copy.statusKind !== 'state' ? (
        // Why anywhere: a long path or command has no spaces to break at.
        <p className="line-clamp-3 rounded-md bg-foreground/[0.05] px-2 py-1.5 leading-relaxed [overflow-wrap:anywhere] text-foreground/80">
          {copy.statusLine}
        </p>
      ) : null}
      {actions?.onJump || actions?.onPopout || actions?.onOpenTab || actions?.onShowInSidebar ? (
        <div className="flex flex-wrap justify-end gap-1">
          {actions.onOpenTab ? (
            <Button type="button" variant="ghost" size="xs" onClick={actions.onOpenTab}>
              <Plus aria-hidden className="size-3.5" />
              {translate('agentHub.hover.openTabHere', 'Open as a tab here')}
            </Button>
          ) : null}
          {actions.onShowInSidebar ? (
            <Button type="button" variant="ghost" size="xs" onClick={actions.onShowInSidebar}>
              <Crosshair aria-hidden className="size-3.5" />
              {translate('agentHub.mirror.showInSidebar', 'Show in sidebar')}
            </Button>
          ) : null}
          {actions.onPopout ? (
            <AgentHubActionTooltip
              label={translate('agentHub.hover.popout', 'Own window')}
              actionId="agentHub.popOut"
            >
              <Button type="button" variant="ghost" size="xs" onClick={actions.onPopout}>
                <PictureInPicture2 aria-hidden className="size-3.5" />
                {translate('agentHub.hover.popout', 'Own window')}
              </Button>
            </AgentHubActionTooltip>
          ) : null}
          {actions.onJump ? (
            <AgentHubActionTooltip
              label={translate(
                'agentHub.mirror.jumpHint',
                'Jump to this terminal in its workspace'
              )}
              actionId={actions.showJumpShortcut ? 'agentHub.jumpToMirror' : undefined}
            >
              <Button type="button" variant="ghost" size="xs" onClick={actions.onJump}>
                <ArrowUpRight aria-hidden className="size-3.5" />
                {translate('agentHub.mirror.jump', 'Jump')}
              </Button>
            </AgentHubActionTooltip>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
