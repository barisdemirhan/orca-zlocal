import { useContext } from 'react'
import { AudioLines, Server } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { getTerminalQuickCommandHostOptions } from '@/lib/terminal/quick-commands/use-terminal-quick-command-hosts'
import { useBotChatTree } from '../bots/use-bot-chat-tree'
import { AgentHubOrbComposerContext } from './agent-hub-orb-composer'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import { useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { useAgentHubOrbBot } from './use-agent-hub-orb-bot'

/** Under the composer in the Orb window: where this chat came from, the host only when there are several, and Live. */
function AgentHubOrbComposerFooter({ tabId }: { tabId: string }): React.JSX.Element {
  const bot = useAgentHubOrbBot()
  const homeTabId = useAgentHubOrbPanel((s) => s.session?.tabId)
  const meta = useAgentHubOrbChatStrip((s) => s.meta)
  const liveId = useAgentHubOrbChatStrip((s) => s.liveId)
  const activeId = useAgentHubOrbChatStrip((s) => s.strip.activeId)
  const hostCount = useAppStore(
    (s) => getTerminalQuickCommandHostOptions(s.settings, s.runtimeEnvironments).length
  )
  const hostLabel = useAppStore((s) => (bot ? selectExecutionHostDisplayLabel(s, bot.hostId) : ''))
  const chats = useBotChatTree(bot).chats
  const sideId =
    tabId === homeTabId ? null : (Object.keys(meta).find((id) => meta[id]?.tabId === tabId) ?? null)
  const origin = sideId ? chats.find((chat) => chat.chatId === sideId)?.origin : 'home'
  const place =
    origin === 'home'
      ? translate('agentHub.orb.footer.home', 'Home chat')
      : origin === 'automation'
        ? translate('agentHub.orb.footer.automation', 'From an automation')
        : translate('agentHub.orb.footer.side', 'Side chat')
  const chatId = sideId ?? AGENT_HUB_ORB_HOME_CHAT
  const liveHere = liveId !== null && liveId === chatId && activeId === chatId
  return (
    <div
      data-agent-hub-orb-composer-footer
      className="mt-1 flex h-5.5 shrink-0 min-w-0 items-center gap-1.5 px-3 text-2xs text-chat-foreground-faint"
    >
      {hostCount > 1 && hostLabel ? (
        <span className="flex min-w-0 max-w-40 shrink items-center gap-1">
          <Server className="size-3 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{hostLabel}</span>
        </span>
      ) : null}
      <span className="truncate">{place}</span>
      {liveHere ? (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <AudioLines className="size-3" aria-hidden />
          {translate('agentHub.orb.footer.live', 'Live is on this chat')}
        </span>
      ) : null}
    </div>
  )
}

/** The Orb window says which of the bot's chats this is; every other chat keeps its own footer. */
export function AgentHubOrbOrWorkspaceFooter({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const orbTabId = useContext(AgentHubOrbComposerContext)
  return orbTabId ? <AgentHubOrbComposerFooter tabId={orbTabId} /> : <>{children}</>
}
