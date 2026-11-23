import { PictureInPicture2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { openBotItem } from '../bots/items/bot-item-open'
import { HubOptionList } from './AgentHubAnswerBody'
import { AgentHubBotAvatar } from './AgentHubBotMark'
import { HubRowAction } from './AgentHubRowActions'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import { agentHubBotAskLine, useAgentHubBotAsk } from './use-agent-hub-bot-ask'
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

/** One numbered ask from a bot: its question and, when it is a single pick, the answer chips. */
export function AgentHubBotAskRow({ bot, item }: { bot: Bot; item: BotItem }): React.JSX.Element {
  const { options, chosen, choose } = useAgentHubBotAsk(bot, item)
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
        <span className="text-xs text-foreground/80">{agentHubBotAskLine(item)}</span>
        {options.length > 0 ? (
          <HubOptionList
            options={options}
            chosen={chosen}
            disabled={chosen !== null}
            density="chip"
            onChoose={(index) => choose(index)}
          />
        ) : (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => openBotItem(bot, item.uid)}
            className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {translate('agentHub.bots.openItem', 'Open')}
          </button>
        )}
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
