import { CornerDownLeft } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { BotAvatar } from '../bots/BotAvatar'
import type { AgentHubBotChatTally } from './agent-hub-tree-bot-groups'

/** Search found a bot by name: one line that opens it in the Bots tab. */
export function AgentHubBotSearchHits({
  hits,
  onOpen
}: {
  hits: readonly AgentHubBotChatTally[]
  onOpen: (botKey: string) => void
}): React.JSX.Element {
  return (
    <>
      {hits.map((hit) => (
        <button
          key={hit.key}
          type="button"
          tabIndex={-1}
          onClick={() => onOpen(hit.key)}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent"
        >
          <BotAvatar bot={hit.bot} className="size-5 shrink-0 rounded-md text-[10px]" />
          <span className="min-w-0 truncate">
            {translate('agentHub.terminals.botHit', '{{name}} · {{count}} chats in Bots', {
              name: hit.bot.name,
              count: hit.chats,
              defaultValue_one: '{{name}} · {{count}} chat in Bots'
            })}
          </span>
          <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </>
  )
}

/** The closing line under the Agents list: the bots' chats live in Bots. */
export function AgentHubBotChatsLine({
  tallies,
  onOpen
}: {
  tallies: readonly AgentHubBotChatTally[]
  onOpen: () => void
}): React.JSX.Element {
  const chats = tallies.reduce((sum, tally) => sum + tally.chats, 0)
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onOpen}
      className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-2 pt-2.5 pb-1 text-left text-xs text-muted-foreground hover:text-foreground"
    >
      <span className="flex -space-x-1.5">
        {tallies.map((tally) => (
          <BotAvatar
            key={tally.key}
            bot={tally.bot}
            className="size-[18px] rounded-full text-[9px] ring-2 ring-popover"
          />
        ))}
      </span>
      {translate('agentHub.terminals.botsCount', '{{count}} bots', {
        count: tallies.length,
        defaultValue_one: '{{count}} bot'
      })}
      {' · '}
      {translate('agentHub.terminals.botChatsCount', '{{count}} chats', {
        count: chats,
        defaultValue_one: '{{count}} chat'
      })}
      <span className="ml-auto">{translate('agentHub.terminals.botsLink', 'Bots →')}</span>
    </button>
  )
}
