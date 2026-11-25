import { useMemo } from 'react'
import { botRefKey } from '@/lib/bot-hosts'
import { useBotActivity } from '../bots/use-bot-activity'
import { useBotOwnChatTree } from '../bots/use-bot-chat-tree'
import { useBotHostOffline } from '@/lib/bot-host-views'
import { AgentHubBotsBotRow, botOfflineReason } from './AgentHubBotsBotRow'
import { AgentHubBotsTree } from './AgentHubBotsTree'
import { botChatNeedsOwner, chatTitleMatches, hubBotChats } from './agent-hub-bots-chats'
import { useBotHostLabel } from '../bots/use-bot-host-label'
import { translate } from '@/i18n/i18n'
import type { Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'

/** One bot with its tree. Under a search it keeps only what matches, and renders nothing when none does. */
export function AgentHubBotsNode({
  bot,
  home,
  needs,
  needle,
  expanded,
  selectedKey,
  multiHost,
  onToggle,
  onOpenPage,
  onNavigate
}: {
  bot: Bot
  home: FolderWorkspace
  needs: number
  needle: string
  expanded: boolean
  selectedKey: string | null
  multiHost: boolean
  onToggle: () => void
  onOpenPage: () => void
  onNavigate: () => void
}): React.JSX.Element | null {
  const refKey = botRefKey(bot)
  const { chats } = useBotOwnChatTree(bot)
  const { automations, inProgress } = useBotActivity(bot)
  const offline = useBotHostOffline(bot.hostId)
  const hostLabel = useBotHostLabel(bot.hostId)
  const nameMatches = needle === '' || bot.name.toLowerCase().includes(needle)
  const open = useMemo(() => hubBotChats(chats), [chats])
  const shown = useMemo(
    () => (nameMatches ? open : open.filter((chat) => chatTitleMatches(chat, needle))),
    [open, nameMatches, needle]
  )
  const summary = useMemo(
    () => ({
      unread: open.filter((chat) => chat.unread).length,
      ask: open.find((chat) => !chat.closed && chat.live === 'needs-you')?.preview ?? null,
      waiting: open.some((chat) => !chat.closed && botChatNeedsOwner(chat)),
      replying: open.some((chat) => !chat.closed && chat.live === 'replying'),
      working:
        inProgress.length > 0 ||
        chats.some((chat) => chat.runningTotal > 0 || chat.live === 'replying'),
      lastActiveAt: open.length > 0 ? Math.max(...open.map((chat) => chat.lastActiveAt)) : null
    }),
    [open, chats, inProgress]
  )
  if (!nameMatches && shown.length === 0) {
    return null
  }
  const blocked = botOfflineReason(
    offline,
    hostLabel ?? translate('agentHub.bots.tab.thisDevice', 'This device')
  )
  const isOpen = expanded || needle !== ''
  return (
    <div>
      <AgentHubBotsBotRow
        bot={bot}
        home={home}
        needs={needs}
        summary={summary}
        expanded={isOpen}
        selected={selectedKey === `bot:${refKey}`}
        multiHost={multiHost}
        onToggle={onToggle}
        onOpenPage={onOpenPage}
        onNavigate={onNavigate}
      />
      {isOpen ? (
        <AgentHubBotsTree
          bot={bot}
          botKey={refKey}
          chats={shown}
          automations={nameMatches ? automations : []}
          selectedKey={selectedKey}
          blocked={blocked}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  )
}
