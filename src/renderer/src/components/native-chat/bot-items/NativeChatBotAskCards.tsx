// The asks of this bot chat that wait on the owner, as a card above the composer: answered in place,
// in the main tab, a hub mirror or a pop-out, on the bot's own host. Later hides a card; the item note's
// Answer in the transcript brings it back.
import { useContext, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useListedBotItemsNeedingOwner } from '@/lib/bot-catalog'
import { useLatestHandler } from '@/lib/use-latest-handler'
import { AgentHubBotAskView } from '../../agent-hub/AgentHubBotAskView'
import { useAgentHubBotAskSteps } from '../../agent-hub/use-agent-hub-bot-ask-steps'
import { useBotItems } from '../../bots/items/use-bot-items'
import { openBotItemInHome } from '../../bots/items/bot-item-open'
import { NativeChatPresentationContext } from '../native-chat-presentation-context'
import type { Bot } from '../../../../../shared/bot-types'
import type { BotItem } from '../../../../../shared/bots/bot-items'
import { hideBotAskCard, pruneHiddenBotAsks, useHiddenBotAsk } from './native-chat-bot-ask-later'

const NO_ITEMS: readonly BotItem[] = []
const CARD_FILL =
  'bg-[color-mix(in_srgb,var(--chat-source-foreground)_var(--chat-user-mix),var(--chat-canvas))] shadow-xs'
/** After an answer the card says so for a moment, then goes. */
const ANSWERED_LINGER_MS = 1800

function askIdOf(item: BotItem): string {
  return item.waitingAsk ?? item.question?.eventId ?? ''
}

/** Whether the item's ask is this chat's: its chat, or the Home Chat's live session after a /clear. */
function askedInChat(bot: Bot, item: BotItem, sessionId: string): boolean {
  return (
    item.status === 'needs_you' &&
    item.snoozedUntil === null &&
    askIdOf(item) !== '' &&
    (item.chat.id === sessionId || (item.chat.kind === 'home' && bot.chatSessionId === sessionId))
  )
}

/** One item's ask as a chat card, from its listed row (the block reads the rest itself). */
export function NativeChatBotAskCard({
  bot,
  item,
  onAnswered
}: {
  bot: Bot
  item: BotItem
  /** Called a moment after the ask was answered. */
  onAnswered?: () => void
}): React.JSX.Element | null {
  const hiddenAsk = useHiddenBotAsk(bot, item.uid)
  const ask = useAgentHubBotAskSteps(bot, item)
  // A part of the answer was sent: the item moved on with its other lines open.
  const answered = ask.phase === 'answered' || (ask.phase === 'open' && !ask.waiting)
  // An ask gone before its events were read has nothing to show or linger on.
  const gone = ask.phase === 'closed'
  const finish = useLatestHandler(() => onAnswered?.())
  useEffect(() => {
    if (gone) {
      finish()
      return undefined
    }
    if (!answered) {
      return undefined
    }
    const timer = setTimeout(finish, ANSWERED_LINGER_MS)
    return () => clearTimeout(timer)
  }, [answered, gone, finish])
  if (gone || hiddenAsk === askIdOf(item)) {
    return null
  }
  return (
    <div className="px-3 pb-2">
      <AgentHubBotAskView
        ask={ask}
        variant="card"
        className={CARD_FILL}
        actions={
          <>
            <Button
              type="button"
              variant="link-muted"
              size="inlineInherit"
              className="text-xs"
              onClick={() => hideBotAskCard(bot, item.uid, askIdOf(item))}
            >
              {translate('agentHub.bots.ask.later', 'Later')}
            </Button>
            <Button
              type="button"
              variant="link-muted"
              size="inlineInherit"
              className="text-xs"
              onClick={() => void openBotItemInHome(bot, item.uid)}
            >
              {translate('agentHub.bots.ask.openItem', 'Open #{{number}}', { number: item.number })}
            </Button>
          </>
        }
      />
    </div>
  )
}

type SeenAsk = { key: string; item: BotItem; finished: boolean }

function BotAskCardsReader({
  bot,
  sessionId,
  settled,
  onIdle
}: {
  bot: Bot
  sessionId: string
  /** No ask waits on the bot any more: once the cards are gone, stop reading. */
  settled: boolean
  onIdle: () => void
}): React.JSX.Element {
  const { read, landed } = useBotItems(bot)
  const items = read?.items ?? NO_ITEMS
  // Until a read has landed the list may be a kept older one: it proves nothing is gone.
  const ready = landed && read !== null
  const mine = items.filter((item) => askedInChat(bot, item, sessionId))
  // An ask stays as a card from when it is first seen until its answer has shown.
  const [seen, setSeen] = useState<readonly SeenAsk[]>([])
  const fresh = mine.filter(
    (item) => !seen.some(({ key }) => key === `${item.uid}:${askIdOf(item)}`)
  )
  if (fresh.length > 0) {
    setSeen([
      ...seen,
      ...fresh.map((item) => ({ key: `${item.uid}:${askIdOf(item)}`, item, finished: false }))
    ])
  }
  // Snoozed or moved on from elsewhere, still waiting: not this chat's card now (it returns if that ends).
  const movedOn = ({ item }: SeenAsk): boolean =>
    ready &&
    items.some(
      (listed) =>
        listed.uid === item.uid &&
        listed.status === 'needs_you' &&
        askIdOf(listed) === askIdOf(item) &&
        !askedInChat(bot, listed, sessionId)
    )
  const cards = seen.filter((ask) => !ask.finished && !movedOn(ask))
  useEffect(() => {
    if (ready) {
      pruneHiddenBotAsks(bot, new Map(items.map((item) => [item.uid, askIdOf(item)])))
    }
  }, [bot, items, ready])
  const idle = settled && cards.length === 0
  useEffect(() => {
    if (idle) {
      onIdle()
    }
  }, [idle, onIdle])
  return (
    <>
      {cards.map(({ key, item }) => (
        <NativeChatBotAskCard
          key={key}
          bot={bot}
          item={mine.find((each) => `${each.uid}:${askIdOf(each)}` === key) ?? item}
          onAnswered={() =>
            setSeen((now) => now.map((ask) => (ask.key === key ? { ...ask, finished: true } : ask)))
          }
        />
      ))}
    </>
  )
}

/** Mounted in a bot's structured chat. Reads nothing until the bot has an ask waiting somewhere, and
 *  stands aside where the Orb draws its own. */
export function NativeChatBotAskCards({
  bot,
  sessionId
}: {
  bot: Bot | null
  sessionId: string
}): React.JSX.Element | null {
  const orb = useContext(NativeChatPresentationContext) === 'orb'
  const waiting = (useListedBotItemsNeedingOwner(bot) ?? 0) > 0
  const [reading, setReading] = useState(false)
  if (waiting && !reading) {
    setReading(true)
  }
  return orb || !reading || !bot ? null : (
    <BotAskCardsReader
      bot={bot}
      sessionId={sessionId}
      settled={!waiting}
      onIdle={() => setReading(false)}
    />
  )
}
