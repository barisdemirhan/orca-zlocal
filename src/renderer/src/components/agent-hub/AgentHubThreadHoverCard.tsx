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
      <dd className="min-w-0 truncate text-foreground/90">{children}</dd>
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
  children
}: {
  thread: AgentPaneThread
  location: AgentHubLocation
  children: React.ReactElement
}): React.JSX.Element {
  return (
    <HoverCard openDelay={350} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-72">
        <ThreadDetails thread={thread} location={location} />
      </HoverCardContent>
    </HoverCard>
  )
}

function ThreadDetails({
  thread,
  location
}: {
  thread: AgentPaneThread
  location: AgentHubLocation
}): React.JSX.Element {
  const now = useNow(30_000)
  const kind = agentHubIndicatorKind(thread)
  const copy = activityThreadRowCopy(thread)
  const entry = thread.paneEntry ?? thread.currentAgentEntry
  const model = entry?.model?.trim()
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
          <span className="flex items-center gap-1.5">
            <HubStateIndicator kind={kind} />
            {threadAgentStateLabel(thread)}
            <span className="text-muted-foreground/70">
              · {formatShortTimeAgo(agentHubStateSince(thread), now)}
            </span>
            {tool ? <HubChip>{tool}</HubChip> : null}
          </span>
        </Detail>
        <Detail label={translate('agentHub.hover.where', 'Where')}>
          <HubCrumb location={location} />
        </Detail>
      </dl>
      {/* A bare state name would repeat the State line above. */}
      {copy.statusLine && copy.statusKind !== 'state' ? (
        <p className="line-clamp-3 rounded-md bg-foreground/[0.05] px-2 py-1.5 leading-relaxed text-foreground/80">
          {copy.statusLine}
        </p>
      ) : null}
    </div>
  )
}
