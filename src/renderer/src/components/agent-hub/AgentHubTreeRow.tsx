import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { translate } from '@/i18n/i18n'
import { HubChip } from './AgentHubInlineLabels'
import { AgentHubChildGroup, SubagentRow } from './AgentHubChildGroup'
import { AgentHubRow } from './AgentHubRow'
import { AgentHubCompactRow } from './AgentHubCompactRow'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import { toggleAgentHubChildren } from './agent-hub-child-expansion'
import { AgentHubRowContextMenu } from './AgentHubRowContextMenu'
import { closeAgentHubAgent } from './agent-hub-close-agent'
import { agentHubStateWord } from './agent-hub-copy'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  agentHubIndicatorKind,
  agentHubStateSince,
  agentHubToolName,
  type AgentHubIndicatorKind
} from './agent-hub-lists'
import type { AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { isAgentHubRowExpanded } from './agent-hub-terminal-tree-view'

function rowKind(row: AgentHubTerminalRow): AgentHubIndicatorKind {
  return row.thread ? agentHubIndicatorKind(row.thread) : 'idle'
}

function compactMuted(
  row: AgentHubTerminalRow,
  kind: AgentHubIndicatorKind,
  tool: string | null
): string | null {
  if (!row.thread) {
    return null
  }
  if (kind === 'ask') {
    return agentHubStateWord(row.thread)
  }
  if (kind === 'work') {
    return tool
  }
  const message = row.thread.currentAgentEntry?.lastAssistantMessage
  return message ? agentHubMessageSummary(message, 120) : null
}

function rowSubtitle(row: AgentHubTerminalRow, sleeping: boolean): string {
  const agent = row.thread?.agentType ?? row.idleAgent
  const who = agent ? `@${agent}` : translate('agentHub.terminals.shell', 'Shell')
  const state = sleeping
    ? translate('agentHub.sleep.group', 'Sleeping')
    : agentHubStateWord(row.thread)
  return `${who} · ${state}`
}

export type TreeRowContext = {
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  /** A search or filter narrows the list, so every fold opens. */
  narrowed: boolean
  selectedKey: string | null
  now: number
  isSleeping: (target: AgentHubPaneTarget) => boolean
  selectionMode?: boolean
  selectionListId?: string
  onToggleChildren?: (key: string) => void
  onOpen: (row: AgentHubTerminalRow) => void
  onPopout: (row: AgentHubTerminalRow) => void
  onJump: (row: AgentHubTerminalRow) => void
  onMarkRead?: (row: AgentHubTerminalRow) => void
}

/** A terminal row, then (when it dispatched workers or runs subagents) their fold. */
export function TreeRow({
  row,
  nested,
  context
}: {
  row: AgentHubTerminalRow
  nested: boolean
  context: TreeRowContext
}): React.JSX.Element {
  const { now } = context
  const kind = rowKind(row)
  const sleeping = context.isSleeping(paneTargetFromTerminalRow(row))
  const tool = row.thread && kind === 'work' ? agentHubToolName(row.thread) : null
  const subagents =
    !context.selectionMode && row.paneKey ? context.lineage.childrenOf(row.paneKey).subagents : []
  const target = paneTargetFromTerminalRow(row)
  const workerCount = row.children.length + subagents.length
  const expanded = isAgentHubRowExpanded(row.key, context.expandedKeys, context.narrowed)
  const toggleChildren = (): void =>
    context.onToggleChildren ? context.onToggleChildren(row.key) : toggleAgentHubChildren(row.key)
  return (
    <>
      <AgentHubRowContextMenu
        target={target}
        mirrorKey={row.paneKey ?? row.tab.id}
        sleeping={sleeping}
        unread={row.thread?.unread === true}
        onJump={() => context.onJump(row)}
        onPopout={() => context.onPopout(row)}
        onMarkRead={context.onMarkRead ? () => context.onMarkRead?.(row) : undefined}
        onClose={() => closeAgentHubAgent(target, kind)}
      >
        {context.selectionMode ? (
          <AgentHubRow
            selectionMode={context.selectionMode}
            optionId={context.selectionListId ? `${context.selectionListId}-${row.key}` : undefined}
            kind={kind}
            agentType={row.thread?.agentType ?? row.idleAgent}
            title={row.title}
            subtitle={rowSubtitle(row, sleeping)}
            sleeping={sleeping}
            worktreeId={row.worktree.id}
            chips={
              <>
                {kind === 'ask' && row.thread ? (
                  <HubChip tone="ask">{agentHubStateWord(row.thread)}</HubChip>
                ) : tool ? (
                  <HubChip>{tool}</HubChip>
                ) : null}
                {row.worktree.linkedPR ? <HubChip>{`#${row.worktree.linkedPR}`}</HubChip> : null}
              </>
            }
            time={row.thread ? formatShortTimeAgo(agentHubStateSince(row.thread), now) : undefined}
            selected={row.key === context.selectedKey}
            indent={!nested}
            // Same key the mirror store gives this row's target (see agentHubPaneTargetKey).
            mirrorKey={row.paneKey ?? row.tab.id}
            mirrorTarget={paneTargetFromTerminalRow(row)}
            onOpen={() => context.onOpen(row)}
            onPopout={() => context.onPopout(row)}
            onJump={() => context.onJump(row)}
            onClose={() => closeAgentHubAgent(target, kind)}
          />
        ) : (
          <AgentHubCompactRow
            optionId={context.selectionListId ? `${context.selectionListId}-${row.key}` : undefined}
            kind={kind}
            agentType={row.thread?.agentType ?? row.idleAgent}
            title={row.title}
            muted={compactMuted(row, kind, tool)}
            askText={kind === 'ask'}
            byBot={row.bot && !row.bot.home ? row.bot.bot.name : null}
            pr={row.worktree.linkedPR}
            workers={
              workerCount > 0
                ? { count: workerCount, expanded, onToggle: toggleChildren }
                : undefined
            }
            sleeping={sleeping}
            worktreeId={row.worktree.id}
            time={row.thread ? formatShortTimeAgo(agentHubStateSince(row.thread), now) : undefined}
            selected={row.key === context.selectedKey}
            depth={nested ? 1 : 0}
            mirrorKey={row.paneKey ?? row.tab.id}
            mirrorTarget={target}
            onOpen={() => context.onOpen(row)}
            onPopout={() => context.onPopout(row)}
            onJump={() => context.onJump(row)}
            onClose={() => closeAgentHubAgent(target, kind)}
          />
        )}
      </AgentHubRowContextMenu>
      {context.selectionMode ? (
        <AgentHubChildGroup
          onToggle={
            context.onToggleChildren ? () => context.onToggleChildren?.(row.key) : undefined
          }
          parentKey={row.key}
          childAgents={{
            workers: row.children.flatMap((child) => child.thread ?? []),
            subagents
          }}
          expanded={isAgentHubRowExpanded(row.key, context.expandedKeys, context.narrowed)}
          indent={!nested}
          now={now}
          focusable={context.selectionMode}
          onOpenParent={() => context.onOpen(row)}
        >
          {row.children.map((child) => (
            <TreeRow key={child.key} row={child} nested context={context} />
          ))}
        </AgentHubChildGroup>
      ) : expanded ? (
        <>
          {row.children.map((child) => (
            <TreeRow key={child.key} row={child} nested context={context} />
          ))}
          {subagents.map((sub) => (
            <SubagentRow key={sub.id} row={sub} now={now} onOpen={() => context.onOpen(row)} />
          ))}
        </>
      ) : null}
    </>
  )
}
