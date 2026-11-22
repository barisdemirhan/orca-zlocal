import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { useNow } from '@/lib/window-activity/use-now'
import { botRefKey } from '@/lib/bot-hosts'
import { BotUpcomingSection } from '../bots/BotUpcomingSection'
import { botAutomationCardRows } from '../bots/bot-automation-card'
import { useBotActivity } from '../bots/use-bot-activity'
import type { Bot } from '../../../../shared/bot-types'
import { BotNeedsBlock } from './AgentHubBotNeeds'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'

const NO_STOPS: ReadonlySet<string> = new Set()

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="px-2 pt-2 pb-0.5 text-xs font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** Home on a bot's page: what waits on the owner, its automations and what it suggests. */
export function AgentHubBotPageHome({ bot }: { bot: Bot }): React.JSX.Element {
  const needs = useAgentHubBotNeedsList().find((entry) => entry.botKey === botRefKey(bot))
  const activity = useBotActivity(bot)
  const clock = useNow(60_000)
  const rows = useMemo(() => botAutomationCardRows(bot, activity, clock), [bot, activity, clock])
  return (
    <div className="flex flex-col pb-2">
      <Section title={translate('agentHub.bots.page.needsYou', 'Needs you')}>
        {needs && needs.count > 0 ? (
          <BotNeedsBlock needs={needs} part="needs" />
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {translate('agentHub.bots.page.nothingNeeded', 'Nothing needs you')}
          </p>
        )}
      </Section>
      <div className="px-2">
        <BotUpcomingSection
          bot={bot}
          rows={rows}
          upNext={activity.upNext?.state}
          hasAutomations={activity.automations.length + activity.waits.length > 0}
          signInStops={NO_STOPS}
          now={clock}
        />
      </div>
      {needs && needs.suggestions.length > 0 ? (
        <Section title={translate('agentHub.bots.page.suggestions', 'Suggestions')}>
          <BotNeedsBlock needs={needs} part="suggestions" />
        </Section>
      ) : null}
    </div>
  )
}
