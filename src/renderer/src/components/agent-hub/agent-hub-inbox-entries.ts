import { botRefKey } from '@/lib/bot-hosts'
import { readHiddenBotAsk } from '../native-chat/bot-items/native-chat-bot-ask-later'
import { activityThreadStatusId } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import { agentHubAlertText } from './agent-hub-alert-text'
import { agentHubThreadCardKey, isAgentHubCardDismissed } from './agent-hub-answered-cards'
import { botQuestionTextKey } from './agent-hub-bot-alert-merge'
import { requestHostId } from './agent-hub-bot-alert-routing'
import type { AgentHubPartialBotAsk } from './agent-hub-bot-ask-partial-store'
import type { AgentHubBotIdentity } from './agent-hub-bot-identity'
import type { AgentHubBotNeeds } from './agent-hub-bot-needs-store'
import type { AgentHubInboxEntry } from './agent-hub-inbox-groups'
import type { AgentHubInboxPayload } from './agent-hub-inbox-model'
import { agentHubInboxRequestText } from './agent-hub-inbox-sender'
import { agentHubStateSince, type AgentHubLists } from './agent-hub-lists'
import type { AgentHubLineage } from './agent-hub-lineage'
import { agentHubInboxRequests, agentHubRequestKey } from './agent-hub-requests-store'
import type { AgentHubRequestsState, AgentHubInboxRequest } from './agent-hub-requests-store'

type Entry = AgentHubInboxEntry<AgentHubInboxPayload>

export type AgentHubInboxEntryInputs = {
  lists: AgentHubLists
  lineage: AgentHubLineage
  requests: AgentHubRequestsState
  botNeeds: readonly AgentHubBotNeeds[]
  partials: readonly AgentHubPartialBotAsk[]
  bots: readonly Bot[]
  botsActive: boolean
  ownsRequest: (item: AgentHubInboxRequest) => boolean
  identityOf: (thread: AgentPaneThread) => AgentHubBotIdentity | null
  chatSessionOf: (thread: AgentPaneThread) => string | null
}

export function agentHubAskIdOf(item: BotItem): string {
  return item.waitingAsk ?? item.question?.eventId ?? ''
}

function failed(thread: AgentPaneThread): boolean {
  const status = activityThreadStatusId(thread)
  return status === 'failed' || status === 'interrupted'
}

function itemOrigin(item: BotItem): string {
  switch (item.chat.kind) {
    case 'home':
      return 'home'
    case 'automation':
      return 'automation'
    default:
      return 'side'
  }
}

function agentSenderKey(thread: AgentPaneThread): string {
  return `${thread.worktree.id}\0${thread.agentType}`
}

/** "@claude" when this agent is the listed dispatcher of the thread. */
function workerOfLabel(
  thread: AgentPaneThread,
  inputs: AgentHubInboxEntryInputs
): string | undefined {
  const parentKey = inputs.lineage.parentOf.get(thread.paneKey)
  if (!parentKey) {
    return undefined
  }
  const { lists } = inputs
  const parent = [...lists.needsYou, ...lists.working, ...lists.finished].find(
    (candidate) => candidate.paneKey === parentKey
  )
  return `@${parent ? formatAgentTypeLabel(parent.agentType).toLowerCase() : 'agent'}`
}

function threadEntries(inputs: AgentHubInboxEntryInputs): Entry[] {
  const out: Entry[] = []
  for (const thread of inputs.lists.needsYou) {
    const cardKey = agentHubThreadCardKey(thread)
    const identity = inputs.botsActive ? inputs.identityOf(thread) : null
    const base = {
      id: `thread:${cardKey}`,
      kind: 'ask' as const,
      since: agentHubStateSince(thread),
      payload: { type: 'thread' as const, thread },
      hidden: isAgentHubCardDismissed(cardKey, 'inbox')
    }
    if (!identity) {
      out.push({
        ...base,
        senderKey: agentSenderKey(thread),
        side: 'agents',
        workerOf: workerOfLabel(thread, inputs)
      })
      continue
    }
    const session = inputs.chatSessionOf(thread)
    const text = agentHubAlertText({ id: base.id, kind: 'ask', thread })
    out.push({
      ...base,
      senderKey: botRefKey(identity.bot),
      side: 'bots',
      source: 'chat',
      origin: identity.origin,
      bot: identity.bot,
      questionKeys: [
        ...(session ? [`chat:${session}`] : []),
        ...(text ? [botQuestionTextKey(text)] : [])
      ]
    })
  }
  for (const thread of inputs.lists.finished) {
    const identity = inputs.botsActive ? inputs.identityOf(thread) : null
    // Why: a bot's worker reports to the bot; its result is never the owner's to read.
    if (identity?.origin === 'worker') {
      continue
    }
    out.push({
      id: `finished:${thread.paneKey}`,
      senderKey: identity ? botRefKey(identity.bot) : agentSenderKey(thread),
      side: identity ? 'bots' : 'agents',
      kind: failed(thread) ? 'fail' : 'result',
      since: agentHubStateSince(thread),
      origin: identity?.origin,
      bot: identity?.bot,
      workerOf: identity ? undefined : workerOfLabel(thread, inputs),
      payload: { type: 'finished', thread }
    })
  }
  return out
}

function requestEntries(inputs: AgentHubInboxEntryInputs): Entry[] {
  const out: Entry[] = []
  for (const item of agentHubInboxRequests(inputs.requests)) {
    if (inputs.ownsRequest(item)) {
      continue
    }
    const { caller } = item.request
    const hostId = requestHostId(item.host)
    const bot =
      inputs.botsActive && caller.kind !== 'orb' && caller.botId
        ? inputs.bots.find((entry) => entry.id === caller.botId && entry.hostId === hostId)
        : undefined
    const orb = inputs.botsActive && caller.kind === 'orb'
    const id = agentHubRequestKey(item.host, item.request.requestId)
    const text = agentHubInboxRequestText(item)
    out.push({
      id,
      senderKey: orb ? 'orb' : bot ? botRefKey(bot) : caller.paneKey,
      side: bot || orb ? 'bots' : 'agents',
      kind: 'ask',
      since: item.request.createdAt,
      source: 'request',
      origin: bot || orb ? 'side' : undefined,
      questionKeys: text ? [botQuestionTextKey(text)] : [],
      payload: { type: 'request', item },
      hidden: isAgentHubCardDismissed(id, 'inbox')
    })
  }
  return out
}

function botEntries(inputs: AgentHubInboxEntryInputs): Entry[] {
  const out: Entry[] = []
  const listed = new Set<string>()
  const addItem = (bot: Bot, item: BotItem, askId: string, remaining: number | null): void => {
    const botKey = botRefKey(bot)
    if (listed.has(`${botKey}\0${item.uid}`)) {
      return
    }
    listed.add(`${botKey}\0${item.uid}`)
    const text = item.question?.text
    out.push({
      id: `bot:${botKey}:${item.uid}:${askId}`,
      senderKey: botKey,
      side: 'bots',
      kind: 'ask',
      since: item.wait?.at ?? item.lastActivityAt,
      source: 'item',
      origin: itemOrigin(item),
      questionKeys: [
        ...(askId ? [`id:${askId}`] : []),
        ...(text ? [botQuestionTextKey(text)] : []),
        ...(item.madeBy ? [`chat:${item.madeBy.chatId}`] : [])
      ],
      payload: { type: 'bot-item', bot, item, askId, remaining },
      hidden: askId !== '' && readHiddenBotAsk(bot, item.uid) === askId
    })
  }
  for (const needs of inputs.botNeeds) {
    const base = { senderKey: needs.botKey, side: 'bots' as const, since: null }
    for (const item of needs.items) {
      addItem(needs.bot, item, agentHubAskIdOf(item), null)
    }
    for (const { key, connector } of needs.connectors) {
      out.push({
        ...base,
        id: `connector:${needs.botKey}:${key}`,
        kind: 'ask',
        payload: { type: 'connector', bot: needs.bot, key, connector }
      })
    }
    for (const request of needs.access) {
      out.push({
        ...base,
        id: `access:${needs.botKey}:${request.requestId}`,
        kind: 'ask',
        payload: { type: 'access', bot: needs.bot, request }
      })
    }
    for (const suggestion of needs.suggestions) {
      out.push({
        ...base,
        id: `suggestion:${needs.botKey}:${suggestion.id}`,
        kind: 'suggestion',
        payload: { type: 'suggestion', bot: needs.bot, suggestion }
      })
    }
  }
  inputs.partials.forEach((partial) =>
    addItem(partial.bot, partial.item, partial.askId, partial.remaining)
  )
  return out
}

/** Every ask, result and suggestion as an entry; hidden asks are flagged, not dropped. */
export function buildAgentHubInboxEntries(inputs: AgentHubInboxEntryInputs): Entry[] {
  return [
    ...threadEntries(inputs),
    ...requestEntries(inputs),
    ...(inputs.botsActive ? botEntries(inputs) : [])
  ]
}
