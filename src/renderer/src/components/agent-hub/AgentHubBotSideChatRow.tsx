import { Clock3, PictureInPicture2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import { HubRowAction } from './AgentHubRowActions'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import { AgentHubInboxDot, AgentHubInboxTime } from './AgentHubInboxParts'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import type { AgentHubInboxItem } from './agent-hub-inbox-model'
import { agentHubBotAskLine } from './use-agent-hub-bot-ask'

/** A bot's plain-text ask (no structured question) as one row: the chat's name and what it said. */
export function AgentHubBotSideChatRow({
  bot,
  item,
  entry,
  context
}: {
  bot: Bot
  item: BotItem
  entry: AgentHubInboxItem
  context: AgentHubInboxEntryContext
}): React.JSX.Element {
  const openMirror = (): void => void mirrorBotChat(bot, item.chat.id)
  const canOpen = !item.chat.gone
  return (
    <div
      data-agent-hub-bot-ask
      data-item-uid={item.uid}
      onClick={canOpen ? openMirror : undefined}
      className="group/side flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-foreground/[0.05]"
    >
      <AgentHubInboxDot kind="ask" />
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">#{item.number}</span>
      {item.chat.title ? (
        <span className="max-w-[40%] shrink-0 truncate font-medium">{item.chat.title}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-xs text-agent-question-text">
        {agentHubBotAskLine(item)}
      </span>
      <span className="hidden items-center gap-0.5 group-hover/side:flex">
        <HubRowAction
          label={translate('agentHub.inbox.menu.later', 'Later')}
          onClick={() => context.onLater(entry)}
        >
          <Clock3 className="size-3.5" />
        </HubRowAction>
        {canOpen ? (
          <HubRowAction
            label={translate('agentHub.bots.mirror', 'Open in mirror')}
            onClick={openMirror}
          >
            <PictureInPicture2 className="size-3.5" />
          </HubRowAction>
        ) : null}
      </span>
      <AgentHubInboxTime
        since={entry.since}
        now={context.now}
        className="group-hover/side:hidden"
      />
    </div>
  )
}
