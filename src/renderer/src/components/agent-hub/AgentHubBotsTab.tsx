import { useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { botRefKey } from '@/lib/bot-hosts'
import { useBotGroups } from '@/lib/bot-group-list'
import { useBotHomeWorkspaces, useBots, useHasBot } from '@/lib/bot-catalog'
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
import { AgentHubBotsNode } from './AgentHubBotsNode'
import { HubRowAction } from './AgentHubRowActions'
import { useAgentHubBotsKeys } from './use-agent-hub-bots-keys'
import {
  readAgentHubPanelListState,
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'

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

function BotsLoading(): React.JSX.Element {
  return (
    <div role="status" className="flex flex-col gap-2 px-2 py-2">
      <span className="sr-only">{translate('agentHub.bots.tab.loading', 'Loading bots…')}</span>
      {['w-24', 'w-32', 'w-20'].map((width) => (
        <div key={width} aria-hidden className="flex items-center gap-2.5">
          <div className="size-8 shrink-0 rounded-md bg-muted/60" />
          <div className="flex flex-col gap-1.5">
            <div className={`h-3 rounded bg-muted ${width}`} />
            <div className="h-2.5 w-40 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The Bots tab: every bot in sidebar order with its chats folded under it, then its groups. */
export function AgentHubBotsTab({ onClose }: { onClose: () => void }): React.JSX.Element {
  const active = useAgentHubBotsActive()
  const bots = useBots(active)
  const hasBot = useHasBot(active)
  const groups = useBotGroups(active)
  const homes = useBotHomeWorkspaces(bots, groups)
  const saved = useMemo(
    () => getHostKeyedBotSidebarEntries(bots, groups, homes),
    [bots, groups, homes]
  )
  const entries = useBotSidebarArrangement(saved)
  const needsList = useAgentHubBotNeedsList()
  const { botsExpanded: expanded, botsQuery: query } = useAgentHubPanelListState()
  const [page, setPage] = useState<OpenPage | null>(() => {
    const pending = readAgentHubPanelListState().pendingBotPage
    if (!pending) {
      return null
    }
    updateAgentHubPanelListState({ pendingBotPage: null })
    return { bot: pending, tab: 'home' }
  })
  const listRef = useRef<HTMLDivElement>(null)
  const needsByBot = useMemo(
    () => new Map(needsList.map((needs) => [needs.botKey, needs.count])),
    [needsList]
  )
  const needle = query.trim().toLowerCase()
  const botEntries = entries.flatMap((entry) => (entry.kind === 'bot' ? [entry] : []))
  const groupEntries = entries.flatMap((entry) => (entry.kind === 'group' ? [entry] : []))
  const multiHost = new Set(botEntries.map(({ bot }) => bot.hostId)).size > 1
  const openPage = page ? botEntries.find((entry) => entry.bot.id === page.bot.id) : undefined
  const { selectedKey } = useAgentHubBotsKeys(listRef, !(page && openPage))
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
      <div className="mt-0.5 mb-1 flex items-center gap-1.5">
        <label
          data-agent-hub-bots-search
          className="flex h-8.5 min-w-0 flex-1 items-center gap-2 rounded-lg border border-foreground/[0.08] bg-background pr-1.5 pl-2.5 text-muted-foreground/70 focus-within:border-foreground/20"
        >
          <Search className="size-3.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => updateAgentHubPanelListState({ botsQuery: event.target.value })}
            placeholder={translate('agentHub.bots.tab.searchChats', 'Search bots and chats')}
            aria-label={translate('agentHub.bots.tab.searchLabel', 'Find a bot')}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </label>
        <HubRowAction label={translate('agentHub.bots.tab.newBot', 'New bot')} onClick={newBot}>
          <Plus className="size-4" />
        </HubRowAction>
      </div>
      {hasBot === null && botEntries.length === 0 ? <BotsLoading /> : null}
      {hasBot !== null && botEntries.length === 0 ? (
        <div className="px-2 py-6 text-center text-xs text-muted-foreground">
          {translate('agentHub.bots.tab.empty', 'No bots yet. Make one to hand work to.')}
        </div>
      ) : null}
      <div ref={listRef} data-agent-hub-bots-list>
        {botEntries.map(({ bot, home }) => {
          const refKey = botRefKey(bot)
          return (
            <AgentHubBotsNode
              key={refKey}
              bot={bot}
              home={home}
              needs={needsByBot.get(`${bot.hostId}/${bot.id}`) ?? 0}
              needle={needle}
              expanded={expanded.has(refKey)}
              selectedKey={selectedKey}
              multiHost={multiHost}
              onToggle={() => {
                const next = new Set(expanded)
                if (!next.delete(refKey)) {
                  next.add(refKey)
                }
                updateAgentHubPanelListState({ botsExpanded: next })
              }}
              onOpenPage={() => setPage({ bot, tab: 'home' })}
              onNavigate={onClose}
            />
          )
        })}
        {needle !== '' ? (
          <div className="hidden px-2 py-6 text-center text-xs text-muted-foreground only:block">
            {translate('agentHub.bots.tab.noMatch', 'No bots or chats match “{{query}}”', {
              query: query.trim()
            })}
          </div>
        ) : null}
      </div>
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
