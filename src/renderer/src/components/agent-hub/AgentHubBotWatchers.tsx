import { useEffect, useMemo } from 'react'
import { useListedBots } from '@/lib/use-listed-bots'
import { botRefKey } from '@/lib/bot-hosts'
import { useNow } from '@/lib/window-activity/use-now'
import { useBotActivity } from '../bots/use-bot-activity'
import { useBotItems } from '../bots/items/use-bot-items'
import { useBotNeedsYouCount, useBotNow } from '../bots/use-bot-now'
import { botItemGroupOf, botItemStaleDays } from '../../../../shared/bots/bot-item-groups'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import type { Suggestion } from '../../../../shared/bots/bot-look-around'
import { publishAgentHubBotNeeds, type AgentHubBotNeeds } from './agent-hub-bot-needs-store'
import { useAgentHubBotsActive } from './agent-hub-bot-identity'
import { useAgentHubBotAlerts } from './use-agent-hub-bot-alerts'

const NO_ITEMS: readonly BotItem[] = []
const NO_SUGGESTIONS: readonly Suggestion[] = []

/** Reads one bot's needs, keeps its published Needs you count alive, and raises its asks. */
function AgentHubBotWatcher({ bot }: { bot: Bot }): null {
  const now = useBotNow(bot)
  // Mounting this is what publishes the bot's count for the dock's robot slot.
  useBotNeedsYouCount(bot, now)
  const read = useBotItems(bot).read
  const activity = useBotActivity(bot)
  const clock = useNow(60_000)
  const staleDays = botItemStaleDays(bot.itemsStale)
  const items = useMemo(
    () =>
      (read?.items ?? NO_ITEMS).filter(
        (item) => botItemGroupOf(item, staleDays, clock) === 'needs_you'
      ),
    [read, staleDays, clock]
  )
  const needs = useMemo<AgentHubBotNeeds>(() => {
    const connectors = now.needs.flatMap((need) =>
      need.kind === 'connector' ? [{ key: need.key, connector: need.connector }] : []
    )
    const access = now.needs.flatMap((need) => (need.kind === 'access' ? [need.request] : []))
    return {
      bot,
      botKey: botRefKey(bot),
      items,
      connectors,
      access,
      suggestions: activity.upNext?.items ?? NO_SUGGESTIONS,
      count: items.length + connectors.length + access.length
    }
  }, [bot, now.needs, items, activity.upNext])
  useEffect(() => publishAgentHubBotNeeds(needs), [needs])
  useAgentHubBotAlerts(needs, read !== null)
  return null
}

/** Headless: one watcher per bot while the hub and bots are on. */
export function AgentHubBotWatchers(): React.JSX.Element | null {
  const active = useAgentHubBotsActive()
  const bots = useListedBots(active)
  return active ? (
    <>
      {bots.map((bot) => (
        <AgentHubBotWatcher key={botRefKey(bot)} bot={bot} />
      ))}
    </>
  ) : null
}
