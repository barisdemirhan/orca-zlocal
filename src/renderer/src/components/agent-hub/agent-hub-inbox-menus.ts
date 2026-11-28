import { translate } from '@/i18n/i18n'
import { openBotItemInHome } from '../bots/items/bot-item-open'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import {
  AGENT_HUB_SENDER_MUTE_MS,
  agentHubBotMuteKey,
  agentHubPaneMuteKey,
  muteAgentHubSenderUntil
} from './agent-hub-sender-mute'
import { agentHubInboxEntryGist, type AgentHubInboxSender } from './agent-hub-inbox-sender'
import type { AgentHubInboxItem, AgentHubInboxItemGroup } from './agent-hub-inbox-model'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'

export type AgentHubInboxMenuItem = {
  id: string
  label: string
  keys?: string
  separatorBefore?: boolean
  onSelect: () => void
}

function finishedKeys(group: AgentHubInboxItemGroup): string[] {
  return [...group.fails, ...group.results].flatMap(({ payload }) =>
    payload.type === 'finished' ? [payload.thread.paneKey] : []
  )
}

/** What a mute of this sender is filed under; null for one that can't be muted on its own. */
export function agentHubInboxSenderMuteKey({ bot, thread }: AgentHubInboxSender): string | null {
  if (bot) {
    return agentHubBotMuteKey(bot)
  }
  return thread ? agentHubPaneMuteKey(thread.paneKey) : null
}

/** The sender's menu: what opens its chat or terminal, "Mark all read" and its mute. */
export function agentHubInboxSenderMenu(
  group: AgentHubInboxItemGroup,
  sender: AgentHubInboxSender,
  context: AgentHubInboxEntryContext,
  muted: boolean
): AgentHubInboxMenuItem[] {
  const muteKey = agentHubInboxSenderMuteKey(sender)
  const mute = muteKey
    ? [
        {
          id: 'mute',
          label: muted
            ? translate('agentHub.bots.tab.unmute', 'Unmute')
            : translate('agentHub.bots.tab.mute', 'Mute for 1 hour'),
          onSelect: () =>
            muteAgentHubSenderUntil(muteKey, muted ? null : Date.now() + AGENT_HUB_SENDER_MUTE_MS)
        }
      ]
    : []
  const markRead = {
    id: 'mark-read',
    label: translate('agentHub.inbox.menu.markAllRead', 'Mark all read'),
    separatorBefore: true,
    onSelect: () => context.onMarkRead(finishedKeys(group))
  }
  const { bot, thread } = sender
  if (bot) {
    const chat = [...group.asks, ...group.fails, ...group.results].find(
      (entry) => entry.payload.type === 'bot-item'
    )
    const chatId = chat?.payload.type === 'bot-item' ? chat.payload.item.chat.id : null
    return [
      {
        id: 'open-chat',
        label: translate('agentHub.inbox.menu.openChat', 'Open chat'),
        onSelect: () => void openBotHomeTab(bot)
      },
      {
        id: 'mirror',
        label: translate('agentHub.inbox.menu.openMirror', 'Open in mirror'),
        onSelect: () => void mirrorBotChat(bot, chatId)
      },
      {
        id: 'page',
        label: translate('agentHub.inbox.menu.openBotPage', 'Open bot page'),
        onSelect: () => context.onOpenBotPage(bot)
      },
      markRead,
      ...mute,
      {
        id: 'settings',
        label: translate('agentHub.inbox.menu.notificationSettings', 'Notification settings…'),
        separatorBefore: true,
        onSelect: () => context.onOpenBotSettings(bot)
      }
    ]
  }
  if (!thread) {
    return [markRead]
  }
  return [
    {
      id: 'jump',
      label: translate('agentHub.inbox.menu.jump', 'Jump to terminal'),
      keys: '↵',
      onSelect: () => context.actions.onJump(thread)
    },
    {
      id: 'popout',
      label: translate('agentHub.inbox.menu.popOut', 'Pop out'),
      keys: '⌥↵',
      onSelect: () => context.actions.onPopout(thread)
    },
    {
      id: 'workspace',
      label: translate('agentHub.inbox.menu.openWorkspace', 'Open workspace'),
      onSelect: () => activateAndRevealWorktree(thread.worktree.id)
    },
    markRead,
    ...mute
  ]
}

/** A question row's menu. */
export function agentHubInboxAskMenu(
  entry: AgentHubInboxItem,
  context: AgentHubInboxEntryContext,
  activate: () => void
): AgentHubInboxMenuItem[] {
  const { payload } = entry
  const items: AgentHubInboxMenuItem[] = [
    {
      id: 'answer',
      label: translate('agentHub.inbox.menu.answer', 'Answer'),
      keys: '↵',
      onSelect: activate
    },
    {
      id: 'later',
      label: translate('agentHub.inbox.menu.later', 'Later'),
      keys: 'L',
      onSelect: () => context.onLater(entry)
    }
  ]
  if (payload.type === 'bot-item') {
    items.push({
      id: 'open-item',
      label: translate('agentHub.inbox.menu.openItem', 'Open #{{number}}', {
        number: payload.item.number
      }),
      onSelect: () => void openBotItemInHome(payload.bot, payload.item.uid)
    })
  }
  items.push(
    {
      id: 'copy',
      label: translate('agentHub.inbox.menu.copyQuestion', 'Copy question'),
      onSelect: () => void window.api.ui.writeClipboardText(agentHubInboxEntryGist(entry))
    },
    {
      id: 'hide',
      label: translate('agentHub.inbox.menu.hideCard', 'Hide card'),
      onSelect: () => context.onLater(entry)
    }
  )
  return items
}
