import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import type { Bot } from '../../../../shared/bot-types'
import { useBotChatTree } from '../bots/use-bot-chat-tree'
import { AgentHubOrbBotFace } from './AgentHubOrbBotFace'
import { AgentHubOrbChatStrip } from './AgentHubOrbChatStrip'
import { AgentHubOrbWindowPane, AgentHubOrbWindowTabRow } from './AgentHubOrbWindowPanes'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import { closeAgentHubOrbSideChat, showAgentHubOrbStripChat } from './agent-hub-orb-side-chat'
import { showAgentHubOrbAsleepHome } from './agent-hub-orb-asleep-home'
import { useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import { closeAgentHubOrbPanel, setAgentHubOrbDestination } from './agent-hub-orb-panel-store'
import { useAgentHubOrbChatOpenOverride } from './use-agent-hub-orb-chat-open-override'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'

const noop = (): void => {}

/** The Orb window while it sleeps: chats stay readable from their journals, nothing can send until Wake. */
export function AgentHubOrbAsleepWindow({ bot }: { bot: Bot }): React.JSX.Element {
  const name = useAgentHubOrbName()
  const tab = useAgentHubOrbChatStrip((s) => s.windowTab)
  const strip = useAgentHubOrbChatStrip((s) => s.strip)
  const meta = useAgentHubOrbChatStrip((s) => s.meta)
  const chats = useBotChatTree(bot).chats
  const homeChatId = chats.find((chat) => chat.origin === 'home')?.chatId ?? null
  const override = useAgentHubOrbChatOpenOverride(noop)
  const homeTitle = translate('agentHub.orb.strip.home', 'Home chat')
  const tabs = useMemo(
    () =>
      strip.chats.map((chat) => ({
        id: chat.id,
        title: chat.id === AGENT_HUB_ORB_HOME_CHAT ? homeTitle : (meta[chat.id]?.title ?? ''),
        status: 'idle' as const,
        live: false,
        ...(meta[chat.id]?.worker ? { readOnly: true, agent: meta[chat.id]?.worker?.agent } : {})
      })),
    [strip.chats, meta, homeTitle]
  )
  const homeActive = strip.activeId === AGENT_HUB_ORB_HOME_CHAT
  useEffect(() => {
    if (homeActive && homeChatId) {
      void showAgentHubOrbAsleepHome(bot, homeChatId)
    }
  }, [bot, homeActive, homeChatId])
  return (
    <section
      aria-label={name}
      data-agent-hub-orb-asleep
      className="flex h-[min(640px,calc(100vh-96px))] min-h-0 flex-col"
    >
      <header className="flex shrink-0 items-center gap-2 px-3 py-2">
        <AgentHubOrbBotFace
          bot={bot}
          size={30}
          sphere={{ phase: 'idle', label: name, decorative: true }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-2xs text-muted-foreground">
            {translate('agentHub.orb.asleep.state', 'Asleep')}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={translate('agentHub.orb.hideNamed', 'Hide {{name}}', { name })}
          onClick={closeAgentHubOrbPanel}
        >
          <X aria-hidden className="size-4" />
        </Button>
      </header>
      <AgentHubOrbWindowTabRow bot={bot} tab={tab} chatWaiting={false} />
      {tab === 'chat' ? (
        <AgentHubOrbChatStrip
          tabs={tabs}
          activeId={strip.activeId}
          limit={tabs.length}
          full
          onActivate={(id) =>
            id === AGENT_HUB_ORB_HOME_CHAT
              ? homeChatId && void showAgentHubOrbAsleepHome(bot, homeChatId)
              : showAgentHubOrbStripChat(id)
          }
          onClose={closeAgentHubOrbSideChat}
        />
      ) : null}
      <div
        ref={setAgentHubOrbDestination}
        className={tab === 'chat' ? 'relative min-h-0 flex-1 overflow-hidden' : 'hidden'}
      />
      {tab !== 'chat' ? <AgentHubOrbWindowPane bot={bot} tab={tab} override={override} /> : null}
    </section>
  )
}
