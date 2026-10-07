import { ChevronRight, SquareTerminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import { WorktreeHostContextBadge } from '@/components/sidebar/WorktreeHostContextBadge'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { AgentHubLocation } from './agent-hub-pane-target'
import type { AgentHubCounts, AgentHubIndicatorKind } from './agent-hub-lists'

export type { AgentHubIndicatorKind }

export function HubStateIndicator({ kind }: { kind: AgentHubIndicatorKind }): React.JSX.Element {
  if (kind === 'work') {
    // Why important: the hub's ring keeps turning with Reduce Motion on, which main.css stops.
    return (
      <AgentWorkingSpinner className="size-[11px] ![animation:agent-spinner-rotate_86400s_steps(1036800,end)_infinite]" />
    )
  }
  return (
    <span
      aria-hidden
      data-kind={kind}
      className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground/40 data-[kind=ask]:animate-pulse data-[kind=ask]:bg-agent-question data-[kind=done]:bg-status-success data-[kind=read]:border-[1.5px] data-[kind=read]:border-status-success/50 data-[kind=read]:bg-transparent"
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
      className="relative grid size-[26px] shrink-0 place-items-center rounded-lg bg-foreground/[0.07] text-muted-foreground data-[shell=true]:bg-foreground/[0.03]"
    >
      {agent ? <AgentIcon agent={agent} size={14} /> : <SquareTerminal className="size-3.5" />}
      {agent && kind ? (
        <span
          aria-hidden
          data-kind={kind}
          className="absolute -right-[3px] -bottom-[3px] size-2.5 rounded-full bg-muted-foreground/50 ring-2 ring-popover data-[kind=ask]:bg-agent-question data-[kind=done]:bg-status-success data-[kind=read]:bg-muted data-[kind=work]:bg-status-warning"
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
          <AgentWorkingSpinner className="size-[9px] border-[1.5px] ![animation:agent-spinner-rotate_86400s_steps(1036800,end)_infinite]" />
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

export function HubChip({
  tone = 'neutral',
  children
}: {
  tone?: 'neutral' | 'ask'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      data-tone={tone}
      className="rounded-[5px] border border-border bg-foreground/[0.05] px-1.5 py-px font-mono text-[10.5px] whitespace-nowrap text-muted-foreground data-[tone=ask]:border-agent-question/25 data-[tone=ask]:bg-agent-question/12 data-[tone=ask]:text-agent-question-text"
    >
      {children}
    </span>
  )
}

/** Compact key chips sized for the hub's dense rows; same platform-label rules as everywhere. */
export function HubKeys({ keys }: { keys: string[] }): React.JSX.Element {
  return (
    <ShortcutKeyCombo
      keys={keys}
      className="gap-0.5"
      separatorClassName="text-[10px] text-muted-foreground"
      keyCapClassName="min-w-0 rounded-[4px] border-border bg-foreground/[0.06] px-[5px] py-[2px] font-mono text-[10.5px] leading-none font-medium shadow-none"
    />
  )
}

/** "+8": workers running under the agents counted beside it. */
export function HubNestedCount({ value }: { value: number | undefined }): React.JSX.Element | null {
  if (!value) {
    return null
  }
  return (
    <span
      title={translate('agentHub.count.nested', '{{value0}} more under them', { value0: value })}
      className="ml-0.5 font-mono text-[0.85em] text-muted-foreground/60"
    >
      +{value}
    </span>
  )
}

export function HubSection({
  label,
  count,
  nested,
  tone = 'neutral',
  action
}: {
  label: string
  count?: number
  /** Workers under the counted agents, shown as "+N". */
  nested?: number
  tone?: 'neutral' | 'ask' | 'done'
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-2 pt-3 pb-[7px]">
      <span className="text-[10.5px] font-semibold tracking-[0.06em] text-muted-foreground/70 uppercase">
        {label}
      </span>
      {count !== undefined ? (
        <span
          data-tone={tone}
          className="font-mono text-[10.5px] text-muted-foreground data-[tone=ask]:text-agent-question data-[tone=done]:text-status-success"
        >
          {count}
          <HubNestedCount value={nested} />
        </span>
      ) : null}
      {action ? <span className="ml-auto flex items-center gap-0.5">{action}</span> : null}
    </div>
  )
}

/** "Group › project · workspace", with the mock's dim separators. */
export function HubCrumb({ location }: { location: AgentHubLocation }): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center text-[11.5px] leading-4 text-muted-foreground">
      <span className="truncate">
        {location.group ? (
          <>
            {location.group}
            <span className="mx-1 text-muted-foreground/60">›</span>
          </>
        ) : null}
        {location.project}
        {location.workspace ? (
          <>
            <span className="mx-1 text-muted-foreground/60">·</span>
            {location.workspace}
          </>
        ) : null}
      </span>
      {location.host ? <WorktreeHostContextBadge label={location.host} className="ml-1.5" /> : null}
    </span>
  )
}

/** Folds its content with a short height and fade; stays mounted but inert while closed. */
export function HubCollapse({
  open,
  children
}: {
  open: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      data-open={open}
      inert={!open}
      className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-150 ease-out data-[open=true]:grid-rows-[1fr] data-[open=true]:opacity-100"
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/** The fold arrow: points right when closed and turns down as its section opens. */
export function HubFoldChevron({
  open,
  className
}: {
  open: boolean
  className: string
}): React.JSX.Element {
  return (
    <span
      data-open={open}
      className="grid shrink-0 place-items-center transition-transform duration-150 ease-out data-[open=true]:rotate-90"
    >
      <ChevronRight className={className} />
    </span>
  )
}
