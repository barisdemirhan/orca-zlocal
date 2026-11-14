import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { translate } from '@/i18n/i18n'
import type { AgentChildRowModel } from '../../../../shared/agent-status/presentation/agent-child-row-model'
import { agentChildRowText } from '../agent-child-row-text'
import { HubChip } from './AgentHubInlineLabels'
import { HubCollapse, HubFoldChevron } from './AgentHubFold'
import { HubCounts, HubStateIndicator } from './AgentHubStateMarks'
import { toggleAgentHubChildren } from './agent-hub-child-expansion'
import {
  agentHubChildCounts,
  agentHubSubagentKind,
  type AgentHubChildren
} from './agent-hub-lineage'

function childGroupLabel(workerCount: number, subagentCount: number): string {
  const parts: string[] = []
  if (workerCount > 0) {
    parts.push(
      workerCount === 1
        ? translate('agentHub.children.agentOne', '1 agent')
        : translate('agentHub.children.agentMany', '{{value0}} agents', { value0: workerCount })
    )
  }
  if (subagentCount > 0) {
    parts.push(
      subagentCount === 1
        ? translate('agentHub.children.subagentOne', '1 subagent')
        : translate('agentHub.children.subagentMany', '{{value0}} subagents', {
            value0: subagentCount
          })
    )
  }
  return parts.join(' · ')
}

/** An in-process subagent: no pane of its own, so a click opens its parent's mirror. */
function SubagentRow({
  row,
  now,
  onOpen
}: {
  row: AgentChildRowModel
  now: number
  onOpen: () => void
}): React.JSX.Element {
  const text = agentChildRowText(row, now)
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-foreground/[0.03]"
    >
      <span className="grid w-3 shrink-0 place-items-center">
        <HubStateIndicator kind={agentHubSubagentKind(row)} />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs">
        <span className="font-medium text-foreground/90">{text.lead}</span>
        {text.trail ? <span className="text-muted-foreground"> · {text.trail}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted-foreground/70">
        {row.model ? <HubChip>{row.model}</HubChip> : null}
        {row.firstObservedAt > 0 ? formatShortTimeAgo(row.firstObservedAt, now) : null}
      </span>
    </button>
  )
}

/** The fold under an agent row ("3 agents · 2 subagents"), then its worker rows and subagents. */
export function AgentHubChildGroup({
  parentKey,
  childAgents,
  expanded,
  indent = false,
  now,
  onOpenParent,
  children,
  onToggle,
  focusable = false
}: {
  parentKey: string
  childAgents: AgentHubChildren
  expanded: boolean
  indent?: boolean
  now: number
  onOpenParent: () => void
  /** The worker rows, rendered by the caller (each surface has its own row model). */
  children: React.ReactNode
  onToggle?: () => void
  focusable?: boolean
}): React.JSX.Element | null {
  const { workers, subagents } = childAgents
  if (workers.length === 0 && subagents.length === 0) {
    return null
  }
  return (
    <div data-indent={indent} className="mb-1 ml-7.5 data-[indent=true]:ml-11">
      <button
        type="button"
        tabIndex={focusable ? 0 : -1}
        aria-expanded={expanded}
        onClick={onToggle ?? (() => toggleAgentHubChildren(parentKey))}
        className="flex h-7 w-full items-center gap-2 rounded-lg bg-foreground/[0.04] px-2.5 text-left text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <span className="min-w-0 flex-1 truncate">
          {childGroupLabel(workers.length, subagents.length)}
        </span>
        <span className="flex items-center gap-2.5 font-mono text-[11px] text-muted-foreground/70">
          <HubCounts counts={agentHubChildCounts(childAgents)} />
        </span>
        <HubFoldChevron open={expanded} className="size-3.5" />
      </button>
      <HubCollapse open={expanded}>
        <div className="mt-0.5 ml-1.5 border-l border-foreground/[0.08] pl-1">
          {children}
          {subagents.map((row) => (
            <SubagentRow key={row.id} row={row} now={now} onOpen={onOpenParent} />
          ))}
        </div>
      </HubCollapse>
    </div>
  )
}
