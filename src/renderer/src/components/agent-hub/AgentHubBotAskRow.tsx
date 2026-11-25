import { PictureInPicture2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { openBotItemInHome } from '../bots/items/bot-item-open'
import { AgentHubBotAskBlock } from './AgentHubBotAskBlock'
import { AgentHubBotAvatar } from './AgentHubBotMark'
import { HubRowAction } from './AgentHubRowActions'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'

/** The bot's name, which opens its Home. */
export function AgentHubBotNameButton({ bot }: { bot: Bot }): React.JSX.Element {
  return (
    <button
      type="button"
      tabIndex={-1}
      data-agent-hub-bot-name
      onClick={() => void openBotHomeTab(bot)}
      className="min-w-0 truncate text-left text-[13px] font-medium text-foreground hover:underline"
    >
      {bot.name}
    </button>
  )
}

/** One numbered ask from a bot, answered in place: its open question, replies and own-words line. */
export function AgentHubBotAskRow({ bot, item }: { bot: Bot; item: BotItem }): React.JSX.Element {
  return (
    <div
      data-agent-hub-bot-ask
      data-item-uid={item.uid}
      className="flex items-start gap-2.5 rounded-lg px-2 py-2"
    >
      <AgentHubBotAvatar identity={{ bot, origin: 'home' }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <AgentHubBotNameButton bot={bot} />
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            #{item.number}
          </span>
        </div>
        <AgentHubBotAskBlock
          bot={bot}
          item={item}
          variant="inline"
          actions={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => void openBotItemInHome(bot, item.uid)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {translate('agentHub.bots.ask.openItem', 'Open #{{number}}', { number: item.number })}
            </button>
          }
        />
      </div>
      {item.chat.gone ? null : (
        <HubRowAction
          label={translate('agentHub.bots.mirror', 'Open in mirror')}
          onClick={() => void mirrorBotChat(bot, item.chat.id)}
        >
          <PictureInPicture2 className="size-3.5" />
        </HubRowAction>
      )}
    </div>
  )
}
