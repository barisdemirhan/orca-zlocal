import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { botRefKey } from '@/lib/bot-hosts'
import { useBots } from '@/lib/bot-catalog'
import { recomputeOn } from '@/lib/recompute-on'
import type { HostAccessRequest } from '@/lib/bot-access-requests'
import {
  showBotAskCard,
  useHiddenBotAsksVersion
} from '../native-chat/bot-items/native-chat-bot-ask-later'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { BotConnectorEntry } from '../bots/bot-connector-entries'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import type { Suggestion } from '../../../../shared/bots/bot-look-around'
import { useAgentHubSurfaceSetting } from './use-agent-hub-surface-setting'
import { useAgentHubPartialBotAsks } from './agent-hub-bot-ask-partial-store'
import { useAgentHubBotsActive } from './agent-hub-bot-identity'
import { readAgentHubBotIdentity } from './agent-hub-bot-identity-read'
import { findAgentHubChatTab } from './agent-hub-chat-tabs'
import { useAgentHubBotNeedsList, type AgentHubBotNeeds } from './agent-hub-bot-needs-store'
import {
  agentHubThreadCardKey,
  showAgentHubCardsAgain,
  useAgentHubCardRecordVersion
} from './agent-hub-answered-cards'
import { useAgentHubPanelListState } from './agent-hub-panel-list-state'
import { agentHubInboxCounts, type AgentHubInboxCounts } from './agent-hub-inbox-counts'
import { buildAgentHubInboxEntries } from './agent-hub-inbox-entries'
import {
  buildAgentHubInboxGroups,
  mergeAgentHubInboxDuplicates,
  type AgentHubInboxEntry,
  type AgentHubInboxGroup,
  type AgentHubInboxSide
} from './agent-hub-inbox-groups'
import type { AgentHubLists } from './agent-hub-lists'
import { EMPTY_AGENT_HUB_LINEAGE, type AgentHubLineage } from './agent-hub-lineage'
import {
  agentHubAwayAnswerCount,
  useAgentHubRequests,
  type AgentHubInboxRequest
} from './agent-hub-requests-store'

export type AgentHubInboxPayload =
  | { type: 'thread'; thread: AgentPaneThread }
  | { type: 'request'; item: AgentHubInboxRequest }
  | {
      type: 'bot-item'
      bot: Bot
      item: BotItem
      askId: string
      /** Lines still open after a partial Send now; null for an ask nothing was sent for. */
      remaining: number | null
    }
  | { type: 'connector'; bot: Bot; key: string; connector: BotConnectorEntry }
  | { type: 'access'; bot: Bot; request: HostAccessRequest }
  | { type: 'finished'; thread: AgentPaneThread }
  | { type: 'suggestion'; bot: Bot; suggestion: Suggestion }

export type AgentHubInboxItem = AgentHubInboxEntry<AgentHubInboxPayload>
export type AgentHubInboxItemGroup = AgentHubInboxGroup<AgentHubInboxPayload>

export type AgentHubInboxModel = {
  boxes: { side: AgentHubInboxSide; groups: AgentHubInboxItemGroup[] }[]
  counts: AgentHubInboxCounts
  /** Asks closed with Later or Hide card: they keep counting. */
  hidden: number
  /** The hidden asks themselves, for the "Show" row. */
  hiddenEntries: AgentHubInboxItem[]
  botsActive: boolean
}

/** Rows for every ask, result and suggestion; hidden asks are flagged, not dropped, so they still count. */
export function useAgentHubInboxModel(
  lists: AgentHubLists,
  ownsRequest: (item: AgentHubInboxRequest) => boolean,
  lineage: AgentHubLineage = EMPTY_AGENT_HUB_LINEAGE
): AgentHubInboxModel {
  const botsActive = useAgentHubBotsActive()
  const order = useAgentHubSurfaceSetting('agentHubInboxOrder')
  const dockCounters = useAgentHubSurfaceSetting('agentHubDockCounters')
  const requests = useAgentHubRequests()
  const botNeeds = useAgentHubBotNeedsList()
  const partials = useAgentHubPartialBotAsks()
  const bots = useBots(botsActive)
  const { sortOrder, sortWithin } = useAgentHubPanelListState()
  const cardVersion = useAgentHubCardRecordVersion()
  const hiddenVersion = useHiddenBotAsksVersion()
  // Why a signature: a thread's bot is read from stores the memo does not subscribe to.
  const identitySignature = useAppStore(() =>
    botsActive
      ? [...lists.needsYou, ...lists.finished].map(agentHubThreadIdentitySignature).join(',')
      : ''
  )
  return useMemo(
    () =>
      recomputeOn([identitySignature, cardVersion, hiddenVersion], () => {
        const merged = mergeAgentHubInboxDuplicates(
          buildAgentHubInboxEntries({
            lists,
            lineage,
            requests,
            botNeeds,
            partials,
            bots,
            botsActive,
            ownsRequest,
            identityOf: (thread) =>
              readAgentHubBotIdentity({ worktree: thread.worktree, tab: thread.tab }),
            chatSessionOf: (thread) =>
              findAgentHubChatTab(useAppStore.getState(), thread.tab.id)?.entityId ?? null
          })
        )
        const counts = agentHubInboxCounts(merged, {
          working: lists.working.length,
          nestedWorking: lists.nestedWorking,
          finished: lists.finished.length + agentHubAwayAnswerCount(requests),
          dockCounters
        })
        const hiddenEntries = merged.filter((entry) => entry.hidden)
        return {
          boxes: buildAgentHubInboxGroups(
            merged.filter((entry) => !entry.hidden),
            order,
            { order: sortOrder, within: sortWithin }
          ).boxes,
          counts,
          hidden: hiddenEntries.length,
          hiddenEntries,
          botsActive
        }
      }),
    [
      lists,
      lineage,
      ownsRequest,
      botsActive,
      order,
      sortOrder,
      sortWithin,
      dockCounters,
      requests,
      botNeeds,
      partials,
      bots,
      identitySignature,
      cardVersion,
      hiddenVersion
    ]
  )
}

function agentHubThreadIdentitySignature(thread: AgentPaneThread): string {
  const identity = readAgentHubBotIdentity({ worktree: thread.worktree, tab: thread.tab })
  return identity ? `${botRefKey(identity.bot)}|${identity.origin}` : ''
}

export type { AgentHubBotNeeds }

export function showAgentHubHiddenEntries(entries: readonly AgentHubInboxItem[]): void {
  const cardKeys: string[] = []
  for (const { payload, id } of entries) {
    if (payload.type === 'thread') {
      cardKeys.push(agentHubThreadCardKey(payload.thread))
    } else if (payload.type === 'request') {
      cardKeys.push(id)
    } else if (payload.type === 'bot-item') {
      showBotAskCard(payload.bot, payload.item.uid)
    }
  }
  if (cardKeys.length > 0) {
    showAgentHubCardsAgain(cardKeys, 'inbox')
  }
}
