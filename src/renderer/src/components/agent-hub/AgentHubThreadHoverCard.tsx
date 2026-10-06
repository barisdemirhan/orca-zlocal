import { AgentHubShortcut } from './AgentHubShortcut'
import { ArrowUpRight, PictureInPicture2 } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { formatAgentTypeLabel } from '../../../../shared/agent-type-label'
import {
  activityThreadRowCopy,
  threadAgentStateLabel
} from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubAvatar, HubChip, HubCrumb, HubStateIndicator } from './AgentHubAtoms'
import { agentHubIndicatorKind, agentHubStateSince, agentHubToolName } from './agent-hub-lists'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { useClaudeSessionModel } from './use-claude-session-model'

export type AgentHubThreadCardActions = {
  /** Present when the agent is on screen nowhere: in no window and not in the workspace. */
  onJump?: () => void
  /** Present when the agent has no window of its own yet. */
  onPopout?: () => void
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
  location,
  actions,
  children
}: {
  thread: AgentPaneThread
  location: AgentHubLocation
  actions?: AgentHubThreadCardActions
  children: React.ReactElement
}): React.JSX.Element {
  return (
    <HoverCard openDelay={350} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-72">
        <ThreadDetails thread={thread} location={location} actions={actions} />
      </HoverCardContent>
    </HoverCard>
  )
}

function ThreadDetails({
  thread,
  location,
  actions
}: {
  thread: AgentPaneThread
  location: AgentHubLocation
  actions?: AgentHubThreadCardActions
}): React.JSX.Element {
  const now = useNow(30_000)
  const kind = agentHubIndicatorKind(thread)
  const copy = activityThreadRowCopy(thread)
  const entry = thread.paneEntry ?? thread.currentAgentEntry
  const reportedModel = entry?.model?.trim()
  const scannedModel = useClaudeSessionModel(
    thread.agentType === 'claude' && !reportedModel ? (entry?.providerSession?.id ?? null) : null
  )
  const model = reportedModel || scannedModel
  const tool = kind === 'work' ? agentHubToolName(thread) : null
  return (
    <div className="flex flex-col gap-2.5 text-[11.5px]">
      <div className="flex items-center gap-2.5">
        <HubAvatar agentType={thread.agentType} kind={kind} />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold text-foreground">
            {copy.taskTitle}
          </div>
          <div className="truncate text-muted-foreground">
            {formatAgentTypeLabel(thread.agentType)}
            {model ? ` · ${model}` : ''}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
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
        <Detail label={translate('agentHub.hover.where', 'Where')}>
          <span className="block truncate">
            <HubCrumb location={location} />
          </span>
        </Detail>
      </dl>
      {/* A bare state name would repeat the State line above. */}
      {copy.statusLine && copy.statusKind !== 'state' ? (
        // Why anywhere: a long path or command has no spaces to break at.
        <p className="line-clamp-3 rounded-md bg-foreground/[0.05] px-2 py-1.5 leading-relaxed [overflow-wrap:anywhere] text-foreground/80">
          {copy.statusLine}
        </p>
      ) : null}
      {actions?.onJump || actions?.onPopout ? (
        <div className="flex justify-end gap-1">
          {actions.onPopout ? (
            <button
              type="button"
              onClick={actions.onPopout}
              className="flex h-6 items-center gap-1.5 rounded-md px-2 text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
            >
              <PictureInPicture2 aria-hidden className="size-3.5" />
              {translate('agentHub.hover.popout', 'Own window')}
              <AgentHubShortcut actionId="agentHub.popOut" />
            </button>
          ) : null}
          {actions.onJump ? (
            <button
              type="button"
              onClick={actions.onJump}
              className="flex h-6 items-center gap-1.5 rounded-md px-2 text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
            >
              <ArrowUpRight aria-hidden className="size-3.5" />
              {translate('agentHub.mirror.jump', 'Jump')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
