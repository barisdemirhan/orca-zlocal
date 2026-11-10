import { SquareTerminal } from 'lucide-react'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'
import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentHubCounts, AgentHubIndicatorKind } from './agent-hub-lists'

export function HubStateIndicator({ kind }: { kind: AgentHubIndicatorKind }): React.JSX.Element {
  if (kind === 'work') {
    return (
      <AgentWorkingSpinner className="size-3 [animation:agent-spinner-rotate_86400s_steps(1036800,end)_infinite] motion-reduce:animate-none!" />
    )
  }
  return (
    <span
      aria-hidden
      data-kind={kind}
      className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground/40 data-[kind=ask]:animate-pulse motion-reduce:animate-none! data-[kind=ask]:bg-agent-question data-[kind=done]:bg-status-success data-[kind=read]:border-[1.5px] data-[kind=read]:border-status-success/50 data-[kind=read]:bg-transparent"
    />
  )
}

/** 26px agent badge with the state dot on its corner; shells get a quiet terminal glyph. */
export function HubAvatar({
  agentType,
  kind
}: {
  agentType: AgentType | null
  kind: AgentHubIndicatorKind | null
}): React.JSX.Element {
  const agent = agentTypeToIconAgent(agentType)
  return (
    <span
      data-shell={agent === null}
      className="relative grid size-6.5 shrink-0 place-items-center rounded-lg bg-foreground/[0.07] text-muted-foreground data-[shell=true]:bg-foreground/[0.03]"
    >
      {agent ? <AgentIcon agent={agent} size={14} /> : <SquareTerminal className="size-3.5" />}
      {agent && kind ? (
        <span
          aria-hidden
          data-kind={kind}
          className="absolute -right-1 -bottom-1 size-2.5 rounded-full bg-muted-foreground/50 ring-2 ring-popover data-[kind=ask]:bg-agent-question data-[kind=done]:bg-status-success data-[kind=read]:bg-muted data-[kind=work]:bg-status-warning"
        />
      ) : null}
    </span>
  )
}

/** "? 2  ◌ 3  • 1": a compact state tally for a group or a parent's children. */
export function HubCounts({ counts }: { counts: AgentHubCounts }): React.JSX.Element {
  return (
    <>
      {counts.needsYou > 0 ? (
        <span className="flex items-center gap-1 text-agent-question-text">
          <HubStateIndicator kind="ask" />
          {counts.needsYou}
        </span>
      ) : null}
      {counts.working > 0 ? (
        <span className="flex items-center gap-1">
          <AgentWorkingSpinner className="size-2.5 border-[1.5px] [animation:agent-spinner-rotate_86400s_steps(1036800,end)_infinite] motion-reduce:animate-none!" />
          {counts.working}
        </span>
      ) : null}
      {counts.finished > 0 ? (
        <span className="flex items-center gap-1">
          <HubStateIndicator kind="done" />
          {counts.finished}
        </span>
      ) : null}
    </>
  )
}
