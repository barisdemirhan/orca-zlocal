import { useCallback, useState } from 'react'
import { Loader2, PictureInPicture2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useBots } from '@/lib/bot-catalog'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { BotAvatar } from '../bots/BotAvatar'
import { AgentHubCompactRow } from './AgentHubCompactRow'
import { SubagentRow } from './AgentHubChildGroup'
import { AgentHubBotRunsReporter, type AgentHubRunningBotRun } from './AgentHubRunningBotRuns'
import { HubSection } from './AgentHubSectionHeader'
import type { AgentHubThreadActions } from './AgentHubPanelSections'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import { toggleAgentHubChildren } from './agent-hub-child-expansion'
import { agentHubStateSince, agentHubToolName, agentHubTurnSince } from './agent-hub-lists'
import { activeAgentHubChildren, type AgentHubLineage } from './agent-hub-lineage'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import { paneTargetFromThread } from './agent-hub-pane-target'
import { groupAgentHubRunningByProject, splitAgentHubRunningByBot } from './agent-hub-running-split'
import type { AgentHubRowBot } from './agent-hub-terminal-tree'
import { useAgentHubWorktreeBot } from './use-agent-hub-worktree-bot'

type BotOfWorktree = (worktree: AgentPaneThread['worktree']) => AgentHubRowBot | null

function threadTarget(thread: AgentPaneThread): ReturnType<typeof paneTargetFromThread> {
  return paneTargetFromThread(thread, activityThreadRowCopy(thread).taskTitle)
}

function activityText(thread: AgentPaneThread): string | null {
  const message = thread.currentAgentEntry?.lastAssistantMessage
  return agentHubToolName(thread) ?? (message ? agentHubMessageSummary(message, 120) : null)
}

/** A working agent on one line, then the workers and subagents it still has at work. */
function RunningRow({
  thread,
  depth = 0,
  now,
  lineage,
  expandedKeys,
  actions
}: {
  thread: AgentPaneThread
  depth?: number
  now: number
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  actions: AgentHubThreadActions
}): React.JSX.Element {
  const childAgents = activeAgentHubChildren(lineage.childrenOf(thread.paneKey))
  const workerCount = childAgents.workers.length + childAgents.subagents.length
  const expanded = expandedKeys.has(thread.paneKey)
  const workspace = actions.locationOf(thread).workspace
  const activity = activityText(thread)
  return (
    <>
      <AgentHubCompactRow
        kind="work"
        agentType={thread.agentType}
        title={activityThreadRowCopy(thread).taskTitle}
        muted={[workspace, activity].filter(Boolean).join(' · ')}
        pr={thread.worktree.linkedPR}
        workers={
          workerCount > 0
            ? {
                count: workerCount,
                expanded,
                onToggle: () => toggleAgentHubChildren(thread.paneKey)
              }
            : undefined
        }
        time={formatShortTimeAgo(agentHubTurnSince(thread), now)}
        selected={actions.isSelected(thread)}
        depth={depth}
        worktreeId={thread.worktree.id}
        mirrorKey={thread.paneKey}
        mirrorTarget={threadTarget(thread)}
        onOpen={() => actions.onOpen(thread)}
        onPopout={() => actions.onPopout(thread)}
        onJump={() => actions.onJump(thread)}
      />
      {expanded ? (
        <>
          {childAgents.workers.map((worker) => (
            <RunningRow
              key={worker.paneKey}
              thread={worker}
              depth={depth + 1}
              now={now}
              lineage={lineage}
              expandedKeys={expandedKeys}
              actions={actions}
            />
          ))}
          {childAgents.subagents.map((sub) => (
            <SubagentRow key={sub.id} row={sub} now={now} onOpen={() => actions.onOpen(thread)} />
          ))}
        </>
      ) : null}
    </>
  )
}

/** A bot at work: its face, "<bot> · <chat>", what it is doing, and when it started. */
function RunningBotRow({
  bot,
  title,
  activity,
  time,
  selected = false,
  onOpen
}: {
  bot: AgentHubRowBot['bot']
  title: string
  activity: string
  time: string
  selected?: boolean
  onOpen?: () => void
}): React.JSX.Element {
  return (
    <div
      role="option"
      aria-selected={selected}
      data-selected={selected}
      data-agent-hub-row
      onClick={onOpen}
      className="group/row flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-accent data-[selected=true]:bg-accent"
    >
      <BotAvatar bot={bot} className="size-7 shrink-0 rounded-lg text-[11px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {bot.name} <span className="text-muted-foreground">· {title}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{activity}</span>
      </span>
      <Loader2 aria-hidden className="size-3 shrink-0 animate-spin text-muted-foreground" />
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">{time}</span>
    </div>
  )
}

export function AgentHubRunningView({
  working,
  botOf,
  botRuns,
  nestedWorking,
  now,
  lineage,
  expandedKeys,
  actions,
  onPopoutAll
}: {
  working: readonly AgentPaneThread[]
  botOf: BotOfWorktree | undefined
  /** Automation runs the bots have in progress; they have no pane, so no keyboard row. */
  botRuns: readonly AgentHubRunningBotRun[]
  /** Workers folded under the rows. */
  nestedWorking: number
  now: number
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  actions: AgentHubThreadActions
  /** Opens every listed agent's mirror at once. */
  onPopoutAll: () => void
}): React.JSX.Element {
  const { agents, bots: botThreads } = splitAgentHubRunningByBot(working, botOf)
  const botCount = botThreads.length + botRuns.length
  if (agents.length === 0 && botCount === 0) {
    return (
      <div className="flex flex-col items-center px-2.5 pt-5.5 pb-4.5 text-center">
        <b className="text-[13px] font-medium text-foreground/85">
          {translate('agentHub.running.empty', 'No agent is working right now')}
        </b>
      </div>
    )
  }
  return (
    <>
      {groupAgentHubRunningByProject(agents).map((group, index) => (
        <div key={group.key}>
          <HubSection
            label={actions.locationOf(group.threads[0]).project}
            count={group.threads.length}
            nested={index === 0 ? nestedWorking : undefined}
            action={
              index === 0 ? (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={onPopoutAll}
                    className="mr-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <PictureInPicture2 aria-hidden className="size-3" />
                    {translate('agentHub.running.popOutAll', 'Pop out all')}
                  </button>
                  <span className="text-[11px] font-medium text-muted-foreground/70">
                    {translate('agentHub.running.longestFirst', 'longest first')}
                  </span>
                </>
              ) : undefined
            }
          />
          {group.threads.map((thread) => (
            <RunningRow
              key={thread.paneKey}
              thread={thread}
              now={now}
              lineage={lineage}
              expandedKeys={expandedKeys}
              actions={actions}
            />
          ))}
        </div>
      ))}
      {botCount > 0 ? (
        <>
          <HubSection label={translate('agentHub.running.bots', 'Bots')} count={botCount} />
          {botThreads.map((thread) => {
            const bot = botOf?.(thread.worktree)?.bot
            return bot ? (
              <RunningBotRow
                key={thread.paneKey}
                bot={bot}
                title={activityThreadRowCopy(thread).taskTitle}
                activity={
                  activityText(thread) ?? translate('agentHub.running.replying', 'Replying…')
                }
                time={formatShortTimeAgo(agentHubStateSince(thread), now)}
                selected={actions.isSelected(thread)}
                onOpen={() => actions.onOpen(thread)}
              />
            ) : null
          })}
          {botRuns.map((run) => (
            <RunningBotRow
              key={run.key}
              bot={run.bot}
              title={run.title}
              activity={translate('agentHub.running.automationRunLine', 'Automation run')}
              time={formatShortTimeAgo(run.at, now)}
              onOpen={run.sessionId ? () => void mirrorBotChat(run.bot, run.sessionId) : undefined}
            />
          ))}
        </>
      ) : null}
    </>
  )
}

export function AgentHubRunningBody(
  props: Omit<Parameters<typeof AgentHubRunningView>[0], 'botOf' | 'botRuns'>
): React.JSX.Element {
  const botOf = useAgentHubWorktreeBot()
  const bots = useBots(botOf !== undefined)
  const [runsByBot, setRunsByBot] = useState<ReadonlyMap<string, AgentHubRunningBotRun[]>>(
    new Map()
  )
  const onRuns = useCallback((botKey: string, runs: AgentHubRunningBotRun[]) => {
    setRunsByBot((current) => {
      const before = current.get(botKey) ?? []
      if (before.length === runs.length && before.every((run, i) => run.key === runs[i]?.key)) {
        return current
      }
      return new Map(current).set(botKey, runs)
    })
  }, [])
  const botRuns = bots.flatMap((bot) => runsByBot.get(`${bot.hostId}:${bot.id}`) ?? [])
  return (
    <>
      {bots.map((bot) => (
        <AgentHubBotRunsReporter key={`${bot.hostId}:${bot.id}`} bot={bot} onRuns={onRuns} />
      ))}
      <AgentHubRunningView {...props} botOf={botOf} botRuns={botRuns} />
    </>
  )
}
