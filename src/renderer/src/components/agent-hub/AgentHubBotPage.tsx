import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, PictureInPicture2, Settings } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { cn } from '@/lib/class-names'
import { getWorktreeStatusLabel } from '@/lib/workspace/activity/worktree-status'
import { BotChatsTab } from '../bots/BotChatsPanel'
import { BotConnectorsPanelBody } from '../bots/BotConnectorsPanel'
import { useBotRowDetails } from '../bots/BotHoverDetails'
import { openBotSettings } from '../bots/bot-settings-open'
import { getLocalExecutionHostLabel } from '../../../../shared/execution-host/execution-host'
import type { Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'
import { botRefKey } from '@/lib/bot-hosts'
import { AgentHubBotPageFiles } from './AgentHubBotPageFiles'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import { AgentHubBotPageHome } from './AgentHubBotPageHome'
import { AgentHubBotQuickSend } from './AgentHubBotQuickSend'
import { AgentHubBotFace, AgentHubBotNeedsPill } from './AgentHubBotsRow'

export type AgentHubBotPageTab = 'home' | 'connectors' | 'chats' | 'files'

const PAGE_TABS: readonly AgentHubBotPageTab[] = ['home', 'connectors', 'chats', 'files']

function pageTabLabel(tab: AgentHubBotPageTab): string {
  switch (tab) {
    case 'home':
      return translate('agentHub.bots.page.tabHome', 'Home')
    case 'connectors':
      return translate('agentHub.bots.page.tabConnectors', 'Connectors')
    case 'chats':
      return translate('agentHub.bots.page.tabChats', 'Chats')
    case 'files':
      return translate('agentHub.bots.page.tabFiles', 'Files')
  }
}

function HeaderAction({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
    >
      {children}
    </button>
  )
}

/** One bot's page inside the popover, replacing the list; Esc steps back to it before the hub closes. */
export function AgentHubBotPage({
  bot,
  home,
  initialTab,
  onBack,
  onClose
}: {
  bot: Bot
  home: FolderWorkspace
  initialTab: AgentHubBotPageTab
  onBack: () => void
  onClose: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState<AgentHubBotPageTab>(initialTab)
  const details = useBotRowDetails(bot, home)
  const needs =
    useAgentHubBotNeedsList().find((entry) => entry.botKey === botRefKey(bot))?.count ?? 0
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onBack()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBack])
  const { hostLabel, offline, status } = details
  const state = offline
    ? translate('agentHub.bots.page.disconnected', 'Disconnected')
    : bot.paused
      ? translate('agentHub.bots.page.paused', 'Paused')
      : status === 'active'
        ? translate('agentHub.bots.page.idle', 'Idle')
        : getWorktreeStatusLabel(status)
  return (
    <div data-agent-hub-bot-page data-bot-id={bot.id} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-1 pt-1.5 pb-1">
        <button
          type="button"
          tabIndex={-1}
          data-agent-hub-bot-page-back
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          {translate('agentHub.bots.tab.title', 'Bots')}
        </button>
        <span className="flex-1" />
        <HeaderAction
          label={translate('agentHub.bots.mirror', 'Open in mirror')}
          onClick={() => void mirrorBotChat(bot, null)}
        >
          <PictureInPicture2 aria-hidden className="size-3.5" />
        </HeaderAction>
        <HeaderAction
          label={translate('agentHub.bots.page.openTab', 'Open {{name}}’s page', {
            name: bot.name
          })}
          onClick={() => {
            void openBotHomeTab(bot)
            onClose()
          }}
        >
          <ExternalLink aria-hidden className="size-3.5" />
        </HeaderAction>
        <HeaderAction
          label={translate('agentHub.bots.page.settings', 'Bot settings')}
          onClick={() => {
            openBotSettings(bot.id)
            onClose()
          }}
        >
          <Settings aria-hidden className="size-3.5" />
        </HeaderAction>
      </div>
      <div className="flex items-center gap-2.5 px-2 pb-2">
        <AgentHubBotFace bot={bot} details={details} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">{bot.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {hostLabel ?? getLocalExecutionHostLabel()} · {state}
          </span>
        </div>
      </div>
      <div role="tablist" className="flex gap-0.5 border-b border-border/60 px-2">
        {PAGE_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            tabIndex={-1}
            aria-selected={tab === id}
            data-agent-hub-bot-page-tab={id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-xs',
              tab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {pageTabLabel(id)}
            {id === 'home' ? <AgentHubBotNeedsPill count={needs} /> : null}
          </button>
        ))}
      </div>
      <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === 'home' ? <AgentHubBotPageHome bot={bot} /> : null}
        {tab === 'connectors' ? <BotConnectorsPanelBody bot={bot} /> : null}
        {tab === 'chats' ? <BotChatsTab bot={bot} /> : null}
        {tab === 'files' ? <AgentHubBotPageFiles bot={bot} onNavigate={onClose} /> : null}
      </div>
      <AgentHubBotQuickSend bot={bot} />
    </div>
  )
}
