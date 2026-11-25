import { useMemo, useRef } from 'react'
import { translate } from '@/i18n/i18n'
import { useNow } from '@/lib/window-activity/use-now'
import { botRefKey } from '@/lib/bot-hosts'
import { useBotHostOffline } from '@/lib/bot-host-views'
import { BotUpcomingSection } from '../bots/BotUpcomingSection'
import { botAutomationCardRows } from '../bots/bot-automation-card'
import { NO_ACTIVITY, useBotActivityAuthorityRead } from '../bots/use-bot-activity'
import { useBotAutomationDelete } from '../bots/use-bot-automation-delete'
import {
  hiddenAutomationCardKeys,
  withoutHiddenAutomations
} from '../bots/bot-automation-delete-hides'
import { useBotNow } from '../bots/use-bot-now'
import type { Bot } from '../../../../shared/bot-types'
import { BotNeedsBlock } from './AgentHubBotNeeds'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex shrink-0 flex-col gap-0.5">
      <h3 className="px-2 pt-2 pb-0.5 text-xs font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** Home on a bot's page: what waits on the owner, its automations and what it suggests. */
export function AgentHubBotPageHome({ bot }: { bot: Bot }): React.JSX.Element {
  const needs = useAgentHubBotNeedsList().find((entry) => entry.botKey === botRefKey(bot))
  const activityRead = useBotActivityAuthorityRead(bot)
  const deletion = useBotAutomationDelete(bot, activityRead, useBotHostOffline(bot.hostId))
  const listed = activityRead.read?.activity ?? NO_ACTIVITY
  const activity = useMemo(
    () => withoutHiddenAutomations(listed, deletion.hidden),
    [listed, deletion.hidden]
  )
  const hiddenKeys = useMemo(
    () => hiddenAutomationCardKeys(listed, deletion.hidden),
    [listed, deletion.hidden]
  )
  const hasConnectorNeed = useBotNow(bot).needs.some((need) => need.kind === 'connector')
  const clock = useNow(60_000)
  const rows = useMemo(() => botAutomationCardRows(bot, activity, clock), [bot, activity, clock])
  const home = useRef<HTMLDivElement | null>(null)
  return (
    // Never shrinks: the page scrolls it above the composer, so Suggestions' buttons stay reachable.
    <div ref={home} tabIndex={-1} className="flex shrink-0 flex-col pb-3 outline-none">
      <Section title={translate('agentHub.bots.page.needsYou', 'Needs you')}>
        {needs && needs.count > 0 ? (
          <BotNeedsBlock needs={needs} part="needs" />
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {translate('agentHub.bots.page.nothingNeeded', 'Nothing needs you')}
          </p>
        )}
      </Section>
      <div className="shrink-0 px-2">
        <BotUpcomingSection
          bot={bot}
          rows={rows}
          hiddenKeys={hiddenKeys}
          deletion={deletion}
          panelFallback={home}
          upNext={activity.upNext?.state}
          hasAutomations={activity.automations.length + activity.waits.length > 0}
          hasConnectorNeed={hasConnectorNeed}
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
