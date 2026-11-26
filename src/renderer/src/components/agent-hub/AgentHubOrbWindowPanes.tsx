import { translate } from '@/i18n/i18n'
import { botRefKey } from '@/lib/bot-hosts'
import { cn } from '@/lib/class-names'
import { BotActivityTab } from '../bots/BotActivityPanel'
import { BotChatsTab } from '../bots/BotChatsPanel'
import { BotConnectorsPanelBody } from '../bots/BotConnectorsPanel'
import {
  BotChatOpenOverrideContext,
  type BotChatOpenOverride
} from '../bots/bot-chat-open-override'
import type { Bot } from '../../../../shared/bot-types'
import { AgentHubBotPageHome } from './AgentHubBotPageHome'
import { AgentHubBotNeedsPill } from './AgentHubBotsRow'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'
import { AttentionDot } from '../bots/AttentionDot'
import {
  setAgentHubOrbWindowTab,
  type AgentHubOrbWindowTab
} from './agent-hub-orb-chat-strip-store'

export const AGENT_HUB_BOT_PAGE_TABS: readonly Exclude<AgentHubOrbWindowTab, 'chat'>[] = [
  'home',
  'chats',
  'connectors',
  'activity'
]

const WINDOW_TABS: readonly AgentHubOrbWindowTab[] = [
  'chat',
  'home',
  'chats',
  'connectors',
  'activity'
]

function windowTabLabel(tab: AgentHubOrbWindowTab): string {
  switch (tab) {
    case 'chat':
      return translate('agentHub.orb.window.tabChat', 'Chat')
    case 'home':
      return translate('agentHub.orb.window.tabHome', 'Home')
    case 'chats':
      return translate('agentHub.orb.window.tabChats', 'Chats')
    case 'connectors':
      return translate('agentHub.orb.window.tabConnectors', 'Connectors')
    case 'activity':
      return translate('agentHub.orb.window.tabActivity', 'Activity')
  }
}

/** Chat | Home | Chats | Connectors | Activity (`tabs` narrows it); Home carries what waits for the owner. */
export function AgentHubOrbWindowTabs({
  tab,
  needs,
  chatWaiting,
  onSelect,
  tabs = WINDOW_TABS
}: {
  tab: AgentHubOrbWindowTab
  needs: number
  chatWaiting: boolean
  onSelect: (tab: AgentHubOrbWindowTab) => void
  tabs?: readonly AgentHubOrbWindowTab[]
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      data-agent-hub-orb-window-tabs
      className="scrollbar-sleek flex shrink-0 gap-0.5 overflow-x-auto border-b border-border px-2"
    >
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          data-agent-hub-orb-window-tab={id}
          onClick={() => onSelect(id)}
          className={cn(
            '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-1.5 text-xs',
            tab === id
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {windowTabLabel(id)}
          {id === 'chat' && chatWaiting && tab !== 'chat' ? <AttentionDot /> : null}
          {id === 'home' ? <AgentHubBotNeedsPill count={needs} /> : null}
        </button>
      ))}
    </div>
  )
}

export function AgentHubOrbWindowTabRow({
  bot,
  tab,
  chatWaiting
}: {
  bot: Bot
  tab: AgentHubOrbWindowTab
  chatWaiting: boolean
}): React.JSX.Element {
  const needs =
    useAgentHubBotNeedsList().find((entry) => entry.botKey === botRefKey(bot))?.count ?? 0
  return (
    <AgentHubOrbWindowTabs
      tab={tab}
      needs={needs}
      chatWaiting={chatWaiting}
      onSelect={setAgentHubOrbWindowTab}
    />
  )
}

/** A bot's Home, Chats, Connectors or Activity; chats it lists open where `override` sends them. */
export function AgentHubOrbWindowPane({
  bot,
  tab,
  override,
  activitySurface
}: {
  bot: Bot
  tab: Exclude<AgentHubOrbWindowTab, 'chat'>
  override: BotChatOpenOverride
  /** Names the Activity tab for item asks aimed at it (see `openBotItemOnSurface`). */
  activitySurface?: string
}): React.JSX.Element {
  return (
    <BotChatOpenOverrideContext.Provider value={override}>
      <div
        data-agent-hub-orb-window-pane={tab}
        className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {tab === 'home' ? <AgentHubBotPageHome bot={bot} /> : null}
        {tab === 'chats' ? <BotChatsTab bot={bot} /> : null}
        {tab === 'connectors' ? <BotConnectorsPanelBody bot={bot} /> : null}
        {tab === 'activity' ? <BotActivityTab bot={bot} surface={activitySurface} /> : null}
      </div>
    </BotChatOpenOverrideContext.Provider>
  )
}
