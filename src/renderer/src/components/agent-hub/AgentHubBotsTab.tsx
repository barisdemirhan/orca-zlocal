import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useBotGroups } from '@/lib/bot-group-list'
import { useBotHomeWorkspaces, useBots } from '@/lib/bot-catalog'
import { BotGroupFaces } from '../bots/BotGroupFaces'
import { getHostKeyedBotSidebarEntries } from '../bots/bot-sidebar-entry-keys'
import { useBotSidebarArrangement } from '../bots/use-bot-sidebar-arrangement'
import { openBotTemplates } from '../bots/templates/bot-templates-open'
import { openBotGroup } from '@/lib/bot-group-catalog'
import { botGroupFaces } from '../../../../shared/bots/bot-group-face-layout'
import { botGroupMemberBots } from '../../../../shared/bots/bot-sidebar-entries'
import type { Bot } from '../../../../shared/bot-types'
import { useAgentHubBotsActive } from './agent-hub-bot-identity'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'
import { AgentHubBotPage, type AgentHubBotPageTab } from './AgentHubBotPage'
import { AgentHubBotsRow } from './AgentHubBotsRow'
import { AgentHubBotsTree } from './AgentHubBotsTree'

type OpenPage = { bot: Bot; tab: AgentHubBotPageTab }

function SectionHeading({
  title,
  count,
  action
}: {
  title: string
  count: number
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
      <span className="text-xs font-semibold text-foreground">{title}</span>
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{count}</span>
      <span className="flex-1" />
      {action}
    </div>
  )
}

/** The Bots tab: every bot in sidebar order with its chats folded under it, then its groups. */
export function AgentHubBotsTab({ onClose }: { onClose: () => void }): React.JSX.Element {
  const active = useAgentHubBotsActive()
  const bots = useBots(active)
  const groups = useBotGroups(active)
  const homes = useBotHomeWorkspaces(bots, groups)
  const saved = useMemo(
    () => getHostKeyedBotSidebarEntries(bots, groups, homes),
    [bots, groups, homes]
  )
  const entries = useBotSidebarArrangement(saved)
  const needsList = useAgentHubBotNeedsList()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [page, setPage] = useState<OpenPage | null>(null)
  const needsByBot = useMemo(
    () => new Map(needsList.map((needs) => [needs.botKey, needs.count])),
    [needsList]
  )
  const botEntries = entries.flatMap((entry) => (entry.kind === 'bot' ? [entry] : []))
  const groupEntries = entries.flatMap((entry) => (entry.kind === 'group' ? [entry] : []))
  const openPage = page ? botEntries.find((entry) => entry.bot.id === page.bot.id) : undefined
  if (page && openPage) {
    return (
      <AgentHubBotPage
        bot={openPage.bot}
        home={openPage.home}
        initialTab={page.tab}
        onBack={() => setPage(null)}
        onClose={onClose}
      />
    )
  }
  const newBot = (): void => {
    openBotTemplates()
    onClose()
  }
  return (
    <div data-agent-hub-bots-tab className="flex flex-col pb-1">
      <SectionHeading
        title={translate('agentHub.bots.tab.title', 'Bots')}
        count={botEntries.length}
        action={
          <button
            type="button"
            tabIndex={-1}
            onClick={newBot}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <Plus aria-hidden className="size-3" />
            {translate('agentHub.bots.tab.newBot', 'New bot')}
          </button>
        }
      />
      {botEntries.length === 0 ? (
        <div className="px-2 py-6 text-center text-xs text-muted-foreground">
          {translate('agentHub.bots.tab.empty', 'No bots yet. Make one to hand work to.')}
        </div>
      ) : null}
      {botEntries.map(({ bot, home }) => {
        const isOpen = expanded.has(bot.id)
        return (
          <div key={`${bot.hostId}/${bot.id}`}>
            <AgentHubBotsRow
              bot={bot}
              home={home}
              needs={needsByBot.get(`${bot.hostId}/${bot.id}`) ?? 0}
              expanded={isOpen}
              onToggle={() =>
                setExpanded((current) => {
                  const next = new Set(current)
                  if (!next.delete(bot.id)) {
                    next.add(bot.id)
                  }
                  return next
                })
              }
              onOpen={() => setPage({ bot, tab: 'home' })}
            />
            {isOpen ? (
              <AgentHubBotsTree
                bot={bot}
                onNavigate={onClose}
                onMore={() => setPage({ bot, tab: 'chats' })}
              />
            ) : null}
          </div>
        )
      })}
      {groupEntries.length > 0 ? (
        <>
          <SectionHeading
            title={translate('agentHub.bots.tab.groups', 'Groups')}
            count={groupEntries.length}
          />
          {groupEntries.map(({ group }) => (
            <button
              key={`${group.hostId}/${group.id}`}
              type="button"
              tabIndex={-1}
              data-agent-hub-bots-group
              data-group-id={group.id}
              onClick={() => {
                void openBotGroup(group)
                  .then(onClose)
                  .catch((error: unknown) => toast.error(String(error)))
              }}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-foreground/[0.04]"
            >
              <BotGroupFaces
                faces={botGroupFaces(botGroupMemberBots(group, bots), (bot) => bot.id)}
                className="size-8"
                slot={32}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {group.name}
              </span>
            </button>
          ))}
        </>
      ) : null}
    </div>
  )
}
