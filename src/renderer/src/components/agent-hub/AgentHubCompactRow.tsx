import { CornerDownLeft, SquareTerminal } from 'lucide-react'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import { BotAvatar } from '../bots/BotAvatar'
import { AgentHubPaneSleepAction } from './AgentHubPaneSleepAction'
import { HubRowAction, HubRowCloseAgent, HubRowMirrorActions } from './AgentHubRowActions'
import { HubStateIndicator } from './AgentHubStateMarks'
import { HubFoldChevron } from './AgentHubFold'
import { HubChip } from './AgentHubInlineLabels'
import { useAgentHubBotIdentity } from './agent-hub-bot-identity'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import { useAgentHubProgress } from './use-agent-hub-progress'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/**
 * The one-line row of the Agents, All and Running lists: state dot, agent icon, title, chips, a
 * muted line that takes the leftover width, workers, time. Hover swaps the time for the actions.
 */
export function AgentHubCompactRow({
  kind,
  agentType,
  title,
  muted,
  askText = false,
  byBot,
  pr,
  workers,
  time,
  selected,
  optionId,
  depth = 0,
  worktreeId,
  mirrorKey,
  mirrorTarget,
  sleeping = false,
  onOpen,
  onPopout,
  onJump,
  onClose
}: {
  kind: AgentHubIndicatorKind
  agentType: AgentType | null
  title: string
  /** Current tool, last activity or the question; nothing for a shell. */
  muted?: string | null
  /** The muted text is the question the agent asks. */
  askText?: boolean
  /** The bot that started this agent's workspace. */
  byBot?: string | null
  pr?: number | null
  workers?: { count: number; expanded: boolean; onToggle: () => void }
  time?: string
  selected: boolean
  optionId?: string
  depth?: number
  worktreeId?: string
  mirrorKey: string
  mirrorTarget: AgentHubPaneTarget
  sleeping?: boolean
  onOpen: () => void
  onPopout: () => void
  onJump: () => void
  onClose?: () => void
}): React.JSX.Element {
  const progress = useAgentHubProgress(mirrorTarget)
  const bot = useAgentHubBotIdentity(mirrorTarget)
  const presence = findAgentHubMirrorMembership(useAgentHubMirrors(), mirrorTarget)?.presence
  const current = useAppStore(
    (s) =>
      worktreeId !== undefined && s.activeView === 'terminal' && s.activeWorktreeId === worktreeId
  )
  const agent = agentTypeToIconAgent(agentType)
  const line = progress ?? muted
  return (
    <div
      role="option"
      id={optionId}
      aria-selected={selected}
      data-selected={selected}
      data-current={current}
      data-agent-hub-row
      data-agent-hub-bot-row={bot?.bot.id}
      title={
        current
          ? translate('agentHub.row.currentWorkspace', 'In the workspace you have open')
          : undefined
      }
      style={{ paddingLeft: 28 + depth * 22 }}
      className="jump-palette-item group/row relative flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-transparent py-1 pr-2 text-[13px] transition-opacity hover:bg-accent data-[current=true]:opacity-55 data-[current=true]:hover:opacity-100 data-[current=true]:data-[selected=true]:opacity-100"
      onClick={onOpen}
    >
      {presence ? (
        <span
          aria-hidden
          data-presence={presence}
          className="absolute inset-y-[5px] left-[18px] w-[2.5px] rounded-full bg-[var(--terminal-pane-locate)] data-[presence=chip]:opacity-35"
        />
      ) : null}
      <span className="grid w-3 shrink-0 place-items-center">
        <HubStateIndicator kind={sleeping ? 'idle' : kind} />
      </span>
      {bot ? (
        <BotAvatar bot={bot.bot} className="size-5 shrink-0 rounded-md text-[10px]" />
      ) : (
        <span
          data-sleeping={sleeping}
          className="grid size-5 shrink-0 place-items-center rounded-md bg-foreground/[0.07] text-muted-foreground data-[sleeping=true]:opacity-45"
        >
          {agent ? <AgentIcon agent={agent} size={13} /> : <SquareTerminal className="size-3.5" />}
        </span>
      )}
      <span
        data-sleeping={sleeping}
        className="min-w-0 shrink truncate font-medium data-[sleeping=true]:opacity-60"
      >
        {bot ? bot.bot.name : title}
      </span>
      {byBot ? (
        <HubChip>{translate('agentHub.terminals.byBot', 'by {{name}}', { name: byBot })}</HubChip>
      ) : null}
      {pr ? <span className="shrink-0 text-xs text-muted-foreground">#{pr}</span> : null}
      <span
        data-ask={askText}
        className="min-w-0 flex-1 truncate text-xs text-muted-foreground data-[ask=true]:text-agent-question-text"
      >
        {bot ? (bot.origin === 'home' ? line : title) : line}
      </span>
      {workers ? (
        <button
          type="button"
          tabIndex={-1}
          aria-expanded={workers.expanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation()
            workers.onToggle()
          }}
          className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[11px] text-muted-foreground hover:bg-foreground/[0.06]"
        >
          {translate('agentHub.row.workers', '{{count}} workers', {
            count: workers.count,
            defaultValue_one: '{{count}} worker'
          })}
          <HubFoldChevron open={workers.expanded} className="size-3" />
        </button>
      ) : null}
      <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground/70">
        {time ? (
          <span className="group-hover/row:hidden group-data-[selected=true]/row:hidden">
            {time}
          </span>
        ) : null}
        <span className="hidden items-center gap-0.5 group-hover/row:flex group-data-[selected=true]/row:flex">
          <HubRowMirrorActions mirrorKey={mirrorKey} target={mirrorTarget} onPopout={onPopout} />
          <AgentHubPaneSleepAction target={mirrorTarget} appearance="row" />
          <HubRowAction
            label={translate('agentHub.row.jump', 'Jump to this terminal')}
            onClick={onJump}
          >
            <CornerDownLeft className="size-3.5" />
          </HubRowAction>
          {onClose ? <HubRowCloseAgent isAgent={agentType !== null} onClose={onClose} /> : null}
        </span>
      </span>
    </div>
  )
}
