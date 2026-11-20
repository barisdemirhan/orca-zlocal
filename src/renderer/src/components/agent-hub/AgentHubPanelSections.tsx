import type { Ref } from 'react'
import { CheckCheck, ChevronLeft, ChevronRight, PictureInPicture2 } from 'lucide-react'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { HubChip, HubCrumb } from './AgentHubInlineLabels'
import { HubSection } from './AgentHubSectionHeader'
import { AgentHubAttentionCard, type AgentHubCardControl } from './AgentHubAttentionCard'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import { AgentHubAwayAnswers } from './AgentHubAwayAnswers'
import { agentHubInboxCards, type AgentHubInboxCard } from './agent-hub-inbox-cards'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { AgentHubChildGroup } from './AgentHubChildGroup'
import { AgentHubRow } from './AgentHubRow'
import { agentHubThreadCardKey } from './agent-hub-answered-cards'
import { closeAgentHubAgent } from './agent-hub-close-agent'
import {
  agentHubStateSince,
  agentHubToolName,
  agentHubTurnSince,
  type AgentHubLists
} from './agent-hub-lists'
import { activeAgentHubChildren, type AgentHubLineage } from './agent-hub-lineage'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import {
  paneTargetFromThread,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'

export type AgentHubThreadActions = {
  locationOf: (thread: AgentPaneThread) => AgentHubLocation
  isSelected: (thread: AgentPaneThread) => boolean
  onJump: (thread: AgentPaneThread) => void
  /** Opens the mirror and leaves the hub (a click on the row). */
  onOpen: (thread: AgentPaneThread) => void
  /** Opens the mirror and keeps the hub open. */
  onPopout: (thread: AgentPaneThread) => void
}

function PagerButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
    >
      {children}
    </button>
  )
}

function lastMessage(thread: AgentPaneThread): string | undefined {
  const entry = thread.paneEntry ?? thread.latestEvent?.entry
  const message = entry?.lastAssistantMessageIsToolOutput
    ? undefined
    : entry?.lastAssistantMessage?.trim()
  return message ? agentHubMessageSummary(message) : undefined
}

export function AgentHubInboxBody({
  lists,
  hiddenCards,
  onShowHidden,
  cardIndex,
  onPage,
  now,
  popoutKeys,
  cardControlRef,
  actions,
  onMarkRead,
  cards = agentHubInboxCards(lists.needsYou, []),
  requestPresentationOf
}: {
  lists: AgentHubLists
  /** Cards closed without an answer; their agents are still waiting. */
  hiddenCards: number
  onShowHidden: () => void
  cardIndex: number
  onPage: (delta: 1 | -1) => void
  now: number
  popoutKeys: string[]
  cardControlRef: Ref<AgentHubCardControl>
  actions: AgentHubThreadActions
  onMarkRead: (paneKeys: string[]) => void
  cards?: readonly AgentHubInboxCard[]
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
}): React.JSX.Element {
  const { finished, working } = lists
  const card = cards[cardIndex] ?? null
  const cardThread = card?.thread ?? null
  return (
    <>
      {card ? (
        <>
          <HubSection
            label={translate('agentHub.inbox.needsYou', 'Needs you')}
            count={cards.length}
            tone="ask"
            action={
              cards.length > 1 ? (
                <>
                  <PagerButton
                    label={translate('agentHub.inbox.previous', 'Previous')}
                    onClick={() => onPage(-1)}
                  >
                    <ChevronLeft className="size-3.5" />
                  </PagerButton>
                  <span className="flex items-center gap-1 px-0.5">
                    {cards.map((card, index) => (
                      <i
                        key={card.key}
                        data-active={index === cardIndex}
                        className="h-1.5 w-1.5 rounded-sm bg-foreground/20 transition-[width,background-color] data-[active=true]:w-4 data-[active=true]:bg-foreground/80"
                      />
                    ))}
                  </span>
                  <PagerButton
                    label={translate('agentHub.inbox.next', 'Next')}
                    onClick={() => onPage(1)}
                  >
                    <ChevronRight className="size-3.5" />
                  </PagerButton>
                </>
              ) : null
            }
          />
          {card.item ? (
            <AgentHubRequestCard
              key={card.key}
              item={card.item}
              presentation={requestPresentationOf(card.item.host, card.item.request)}
              controlRef={cardControlRef}
            />
          ) : cardThread ? (
            <AgentHubAttentionCard
              // Why the state stamp: a new prompt on the same pane must start unanswered.
              key={agentHubThreadCardKey(cardThread)}
              thread={cardThread}
              location={actions.locationOf(cardThread)}
              now={now}
              popoutKeys={popoutKeys}
              controlRef={cardControlRef}
              onJump={() => actions.onJump(cardThread)}
              // Why open, not pop out: the card answers one agent, so its mirror takes over and the
              // hub steps aside; an open mirror comes forward and glows.
              onPopout={() => actions.onOpen(cardThread)}
            />
          ) : null}
        </>
      ) : hiddenCards > 0 ? null : (
        <div className="flex flex-col items-center gap-1 px-2.5 pt-5.5 pb-4.5 text-center text-xs text-muted-foreground">
          <CheckCheck className="mb-1 size-5 text-status-success" />
          <b className="text-[13px] font-medium text-foreground/85">
            {translate('agentHub.inbox.emptyTitle', 'Nobody is waiting on you')}
          </b>
          <span>
            {translate(
              'agentHub.inbox.emptyHint',
              "{{value0}} working · you'll get a ping when one asks",
              {
                value0:
                  working.length === 1
                    ? translate('agentHub.inbox.oneAgent', '1 agent')
                    : translate('agentHub.inbox.agents', '{{value0}} agents', {
                        value0: working.length
                      })
              }
            )}
          </span>
        </div>
      )}
      <AgentHubAwayAnswers presentationOf={requestPresentationOf} />
      {hiddenCards > 0 ? (
        <button
          type="button"
          tabIndex={-1}
          data-agent-hub-hidden-cards
          onClick={onShowHidden}
          className="mt-1.5 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {translate('agentHub.inbox.hidden', '{{value0}} hidden · Show', { value0: hiddenCards })}
        </button>
      ) : null}
      {finished.length > 0 ? (
        <>
          <HubSection
            label={translate('agentHub.inbox.finished', 'Finished')}
            count={finished.length}
            tone="done"
            action={
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onMarkRead(finished.map((thread) => thread.paneKey))}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {translate('agentHub.inbox.markAllRead', 'Mark all read')}
              </button>
            }
          />
          {finished.map((thread) => (
            <AgentHubRow
              key={thread.paneKey}
              kind="done"
              agentType={thread.agentType}
              title={activityThreadRowCopy(thread).taskTitle}
              subtitle={<HubCrumb location={actions.locationOf(thread)} />}
              snippet={lastMessage(thread)}
              time={formatShortTimeAgo(agentHubStateSince(thread), now)}
              selected={actions.isSelected(thread)}
              worktreeId={thread.worktree.id}
              mirrorKey={thread.paneKey}
              mirrorTarget={closeTarget(thread)}
              onOpen={() => actions.onOpen(thread)}
              onPopout={() => actions.onPopout(thread)}
              onJump={() => actions.onJump(thread)}
              onMarkRead={() => onMarkRead([thread.paneKey])}
              onClose={() => closeAgentHubAgent(closeTarget(thread), 'done')}
            />
          ))}
        </>
      ) : null}
    </>
  )
}

function closeTarget(thread: AgentPaneThread): AgentHubPaneTarget {
  return paneTargetFromThread(thread, activityThreadRowCopy(thread).taskTitle)
}

/** A working agent, then the workers and subagents it still has at work. */
function RunningRow({
  thread,
  now,
  lineage,
  expandedKeys,
  actions
}: {
  thread: AgentPaneThread
  now: number
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  actions: AgentHubThreadActions
}): React.JSX.Element {
  const tool = agentHubToolName(thread)
  const childAgents = activeAgentHubChildren(lineage.childrenOf(thread.paneKey))
  return (
    <>
      <AgentHubRow
        kind="work"
        agentType={thread.agentType}
        title={activityThreadRowCopy(thread).taskTitle}
        subtitle={<HubCrumb location={actions.locationOf(thread)} />}
        chips={tool ? <HubChip>{tool}</HubChip> : null}
        time={formatShortTimeAgo(agentHubTurnSince(thread), now)}
        selected={actions.isSelected(thread)}
        worktreeId={thread.worktree.id}
        mirrorKey={thread.paneKey}
        mirrorTarget={closeTarget(thread)}
        onOpen={() => actions.onOpen(thread)}
        onPopout={() => actions.onPopout(thread)}
        onJump={() => actions.onJump(thread)}
        onClose={() => closeAgentHubAgent(closeTarget(thread), 'work')}
      />
      <AgentHubChildGroup
        parentKey={thread.paneKey}
        childAgents={childAgents}
        expanded={expandedKeys.has(thread.paneKey)}
        now={now}
        onOpenParent={() => actions.onOpen(thread)}
      >
        {childAgents.workers.map((worker) => (
          <RunningRow
            key={worker.paneKey}
            thread={worker}
            now={now}
            lineage={lineage}
            expandedKeys={expandedKeys}
            actions={actions}
          />
        ))}
      </AgentHubChildGroup>
    </>
  )
}

export function AgentHubRunningBody({
  working,
  nestedWorking,
  now,
  lineage,
  expandedKeys,
  actions,
  onPopoutAll
}: {
  working: AgentPaneThread[]
  /** Workers folded under the rows. */
  nestedWorking: number
  now: number
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  actions: AgentHubThreadActions
  /** Opens every listed agent's mirror at once. */
  onPopoutAll: () => void
}): React.JSX.Element {
  if (working.length === 0) {
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
      <HubSection
        label={translate('agentHub.running.working', 'Working')}
        count={working.length}
        nested={nestedWorking}
        action={
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
        }
      />
      {working.map((thread) => (
        <RunningRow
          key={thread.paneKey}
          thread={thread}
          now={now}
          lineage={lineage}
          expandedKeys={expandedKeys}
          actions={actions}
        />
      ))}
    </>
  )
}
