import { translate } from '@/i18n/i18n'
import { botRefKey } from '@/lib/bot-hosts'
import { cn } from '@/lib/class-names'
import { AttentionDot } from '../bots/AttentionDot'
import { BotChatsTab } from '../bots/BotChatsPanel'
import type { Bot } from '../../../../shared/bot-types'
import { AgentHubBotPageHome } from './AgentHubBotPageHome'
import { AgentHubBotNeedsPill } from './AgentHubBotsRow'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'

export type AgentHubOrbMiniTab = 'chat' | 'home' | 'chats'

const TABS: readonly AgentHubOrbMiniTab[] = ['chat', 'home', 'chats']

function tabLabel(tab: AgentHubOrbMiniTab): string {
  switch (tab) {
    case 'chat':
      return translate('agentHub.orb.mini.tabChat', 'Chat')
    case 'home':
      return translate('agentHub.orb.mini.tabHome', 'Home')
    case 'chats':
      return translate('agentHub.orb.mini.tabChats', 'Chats')
  }
}

/** The mini window's Chat | Home | Chats row; Home carries the count of things that need the owner. */
export function AgentHubOrbMiniTabRow({
  bot,
  tab,
  chatWaiting,
  onSelect
}: {
  bot: Bot
  tab: AgentHubOrbMiniTab
  /** A request waits in the chat while another tab shows. */
  chatWaiting: boolean
  onSelect: (tab: AgentHubOrbMiniTab) => void
}): React.JSX.Element {
  const needs =
    useAgentHubBotNeedsList().find((entry) => entry.botKey === botRefKey(bot))?.count ?? 0
  return (
    <div
      role="tablist"
      data-agent-hub-orb-mini-tabs
      className="flex shrink-0 gap-0.5 border-b border-border/60 px-2"
    >
      {TABS.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          data-agent-hub-orb-mini-tab={id}
          onClick={() => onSelect(id)}
          className={cn(
            '-mb-px inline-flex items-center gap-1.5 border-b-2 px-2 py-1 text-xs',
            tab === id
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tabLabel(id)}
          {id === 'chat' && chatWaiting && tab !== 'chat' ? <AttentionDot /> : null}
          {id === 'home' ? <AgentHubBotNeedsPill count={needs} /> : null}
        </button>
      ))}
    </div>
  )
}

/** The Orb bot's Home or Chats, filling the mini window under the tab row. */
export function AgentHubOrbMiniBotPane({
  bot,
  tab
}: {
  bot: Bot
  tab: 'home' | 'chats'
}): React.JSX.Element {
  return (
    <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto">
      {tab === 'home' ? <AgentHubBotPageHome bot={bot} /> : <BotChatsTab bot={bot} />}
    </div>
  )
}
