import type { Ref } from 'react'
import type { Bot } from '../../../../shared/bot-types'
import { AgentHubAttentionCard, type AgentHubCardControl } from './AgentHubAttentionCard'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import { AgentHubBotAskRow } from './AgentHubBotAskRow'
import { BotNeedsBlock } from './AgentHubBotNeeds'
import type { AgentHubThreadActions } from './AgentHubPanelSections'
import type { AgentHubInboxItem } from './agent-hub-inbox-model'
import { botRefKey } from '@/lib/bot-hosts'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

export type AgentHubInboxEntryContext = {
  now: number
  popoutKeys: string[]
  actions: AgentHubThreadActions
  presentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
  onMarkRead: (paneKeys: string[]) => void
  /** Later and Hide card: the same record, and never an answer. */
  onLater: (entry: AgentHubInboxItem) => void
  onOpenEntry: (entry: AgentHubInboxItem, popout: boolean) => void
  onOpenBotPage: (bot: Bot) => void
  onOpenBotSettings: (bot: Bot) => void
}

/** One entry at full size: the answer card for an ask, a finished row for a result. */
export function AgentHubInboxEntryView({
  entry,
  context,
  controlRef
}: {
  entry: AgentHubInboxItem
  context: AgentHubInboxEntryContext
  controlRef?: Ref<AgentHubCardControl>
}): React.JSX.Element | null {
  const { payload } = entry
  const { actions, now } = context
  switch (payload.type) {
    case 'thread':
      return (
        <AgentHubAttentionCard
          thread={payload.thread}
          location={actions.locationOf(payload.thread)}
          now={now}
          popoutKeys={context.popoutKeys}
          controlRef={controlRef ?? null}
          onJump={() => actions.onJump(payload.thread)}
          onPopout={() => actions.onOpen(payload.thread)}
        />
      )
    case 'request':
      return (
        <AgentHubRequestCard
          item={payload.item}
          presentation={context.presentationOf(payload.item.host, payload.item.request)}
          controlRef={controlRef}
        />
      )
    case 'bot-item':
      return <AgentHubBotAskRow bot={payload.bot} item={payload.item} bare />
    case 'connector':
    case 'access':
    case 'suggestion':
      return (
        <BotNeedsBlock
          part={payload.type === 'suggestion' ? 'suggestions' : 'needs'}
          needs={{
            bot: payload.bot,
            botKey: botRefKey(payload.bot),
            items: [],
            connectors: payload.type === 'connector' ? [payload] : [],
            access: payload.type === 'access' ? [payload.request] : [],
            suggestions: payload.type === 'suggestion' ? [payload.suggestion] : [],
            count: 0
          }}
        />
      )
    case 'finished':
      return null
  }
}
