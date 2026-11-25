import { SquareTerminal } from 'lucide-react'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { cn } from '@/lib/class-names'
import { BotAvatar } from '../bots/BotAvatar'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { Bot } from '../../../../shared/bot-types'
import { HubAvatar } from './AgentHubStateMarks'

export type AgentHubInboxDotKind = 'ask' | 'fail' | 'done'

export function AgentHubInboxDot({ kind }: { kind: AgentHubInboxDotKind }): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-kind={kind}
      className="size-2 shrink-0 rounded-full bg-agent-question data-[kind=done]:bg-status-success data-[kind=fail]:bg-destructive"
    />
  )
}

/** Bots are round at 32 px, agents a rounded 26 px badge; the state dot sits on the corner. */
export function AgentHubInboxFace({
  bot,
  agentType,
  kind
}: {
  bot: Bot | null
  agentType: AgentType | null
  kind: AgentHubInboxDotKind | null
}): React.JSX.Element {
  if (bot) {
    return (
      <span className="relative grid size-8 shrink-0 place-items-center">
        <BotAvatar bot={bot} className="size-8 rounded-full text-xs" />
        {kind ? (
          <span className="absolute -right-0.5 -bottom-0.5 grid rounded-full bg-popover p-0.5">
            <AgentHubInboxDot kind={kind} />
          </span>
        ) : null}
      </span>
    )
  }
  return (
    <span className="relative shrink-0">
      <HubAvatar agentType={agentType} kind={kind === 'fail' ? null : kind} />
      {kind === 'fail' ? (
        <span className="absolute -right-1 -bottom-1 grid rounded-full bg-popover p-0.5">
          <AgentHubInboxDot kind="fail" />
        </span>
      ) : null}
    </span>
  )
}

/** The 18 px round faces in a section header. */
export function AgentHubInboxMiniFace({
  bot,
  agentType
}: {
  bot: Bot | null
  agentType: AgentType | null
}): React.JSX.Element {
  if (bot) {
    return <BotAvatar bot={bot} className="size-4.5 rounded-full text-[9px] ring-2 ring-popover" />
  }
  const agent = agentTypeToIconAgent(agentType)
  return (
    <span className="grid size-4.5 place-items-center rounded-full bg-muted text-muted-foreground ring-2 ring-popover">
      {agent ? <AgentIcon agent={agent} size={10} /> : <SquareTerminal className="size-2.5" />}
    </span>
  )
}

export function AgentHubInboxTime({
  since,
  now,
  className
}: {
  since: number | null
  now: number
  className?: string
}): React.JSX.Element | null {
  if (since === null) {
    return null
  }
  return (
    <span className={cn('shrink-0 font-mono text-[11px] text-muted-foreground', className)}>
      {formatShortTimeAgo(since, now)}
    </span>
  )
}

export function AgentHubInboxLink({
  children,
  onClick
}: {
  children: React.ReactNode
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className="text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  )
}
