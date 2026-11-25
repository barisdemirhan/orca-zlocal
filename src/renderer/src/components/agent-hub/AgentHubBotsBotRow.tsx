import {
  ChevronRight,
  EyeOff,
  MessageSquarePlus,
  Moon,
  PictureInPicture2,
  Settings
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { botRefKey } from '@/lib/bot-hosts'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { useAppStore } from '@/store'
import { collectTwinHostsAlsoSlept } from '@/components/sidebar/workspace-actions/sleep/sleep-twin-confirmation'
import { runSleepWorktree } from '@/components/sidebar/workspace-actions/sleep/sleep-worktree-flow'
import { useBotAvatarBadgeSleeping } from '../bots/bot-avatar-status-badge'
import { BotRowLineView } from '../bots/BotRowActivityLine'
import { useBotRowDetails } from '../bots/BotHoverDetails'
import { openBotSettings, openBotSettingsPage } from '../bots/bot-settings-open'
import { useOrcaCloudSignedOut } from '../bots/orca-cloud-signed-out'
import { AgentHubBotFace, AgentHubBotHostChip, AgentHubBotNeedsPill } from './AgentHubBotsRow'
import { BotsContextMenu, BotsMoreMenu, type BotsMenuEntry } from './AgentHubBotsMenus'
import { HubRowAction } from './AgentHubRowActions'
import {
  AGENT_HUB_SENDER_MUTE_MS,
  agentHubBotMuteKey,
  muteAgentHubSenderUntil,
  useAgentHubSenderMuted
} from './agent-hub-sender-mute'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import { startBotSideChat } from './agent-hub-bots-actions'
import { botSlackApps, botLinearWorkspaces, type Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'

export type BotRowSummary = {
  unread: number
  lastActiveAt: number | null
  /** The question of a chat waiting on the owner, when it has one. */
  ask: string | null
  waiting: boolean
  replying: boolean
  /** A chat, a worker or an automation run is still at work. */
  working: boolean
}

/** The reason a bot's actions are off while its host is down; null while they work. */
export function botOfflineReason(offline: boolean, host: string): string | null {
  return offline
    ? translate('agentHub.bots.tab.hostOfflineReason', '{{host}} is offline', { host })
    : null
}

/** Sleeps the bot's home as the sidebar does, asking first when host twins would sleep with it. */
function sleepBotHome(bot: Bot, workspaceId: string, onNavigate: () => void): void {
  const state = useAppStore.getState()
  const hostIds = collectTwinHostsAlsoSlept(state, [{ id: workspaceId, hostId: bot.hostId }])
  if (hostIds.length > 0) {
    state.openModal('confirm-sleep-twin', { worktreeIds: [workspaceId], hostIds })
    onNavigate()
    return
  }
  void runSleepWorktree(workspaceId)
}

function usesOrcaCloud(bot: Bot): boolean {
  return botSlackApps(bot).length > 0 || bot.github !== null || botLinearWorkspaces(bot).length > 0
}

function StateLine({ text, tone }: { text: string; tone?: 'warn' | 'ask' }): React.JSX.Element {
  return (
    <div
      className={cn(
        'truncate text-xs leading-4',
        tone === 'warn' && 'text-status-warning-text',
        tone === 'ask' && 'text-agent-question-text',
        tone === undefined && 'text-muted-foreground'
      )}
    >
      {text}
    </div>
  )
}

/** One bot in the Bots tab: a chevron that folds its tree, and a row that opens its Home chat. */
export function AgentHubBotsBotRow({
  bot,
  home,
  needs,
  summary,
  expanded,
  selected,
  multiHost,
  onToggle,
  onOpenPage,
  onNavigate
}: {
  bot: Bot
  home: FolderWorkspace
  needs: number
  summary: BotRowSummary
  expanded: boolean
  selected: boolean
  /** Bots run on two or more hosts, so each row names its own. */
  multiHost: boolean
  onToggle: () => void
  onOpenPage: () => void
  onNavigate: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const details = useBotRowDetails(bot, home)
  const { hostLabel, offline, line, limit, description, now, status, workspaceId } = details
  const sleeping = useBotAvatarBadgeSleeping(workspaceId, offline ? null : status)
  const signedOut = useOrcaCloudSignedOut(bot.hostId) && usesOrcaCloud(bot)
  const host = hostLabel ?? t('agentHub.bots.tab.thisDevice', 'This device')
  const blocked = botOfflineReason(offline, host)
  const navKey = `bot:${botRefKey(bot)}`
  const openHome = (): void => {
    if (!blocked) {
      void openBotHomeTab(bot).then(onNavigate)
    }
  }
  const busy = summary.waiting || summary.working
  const muteKey = agentHubBotMuteKey(bot)
  const muted = useAgentHubSenderMuted(muteKey)
  const entries: BotsMenuEntry[] = [
    {
      key: 'new',
      label: t('agentHub.bots.tab.newChat', 'New chat'),
      icon: <MessageSquarePlus className="size-3.5" />,
      blocked,
      onSelect: () => {
        startBotSideChat(bot)
        onNavigate()
      }
    },
    {
      key: 'open',
      label: t('agentHub.bots.tab.openChat', 'Open chat'),
      shortcut: '↵',
      blocked,
      onSelect: openHome
    },
    {
      key: 'mirror',
      label: t('agentHub.bots.mirror', 'Open in mirror'),
      shortcut: '⌥↵',
      blocked,
      onSelect: () => void mirrorBotChat(bot, null)
    },
    { key: 'page', label: t('agentHub.bots.tab.openPage', 'Open page'), onSelect: onOpenPage },
    'separator',
    {
      key: 'sleep',
      label: t('agentHub.bots.tab.sleep', 'Sleep'),
      icon: <Moon className="size-3.5" />,
      blocked:
        blocked ??
        (busy
          ? t('agentHub.bots.tab.sleepBusy', 'Busy right now')
          : sleeping
            ? t('agentHub.bots.tab.sleepAlready', 'Already asleep')
            : null),
      onSelect: () => sleepBotHome(bot, workspaceId, onNavigate)
    },
    {
      key: 'mute',
      label: muted
        ? t('agentHub.bots.tab.unmute', 'Unmute')
        : t('agentHub.bots.tab.mute', 'Mute for 1 hour'),
      icon: <EyeOff className="size-3.5" />,
      onSelect: () =>
        muteAgentHubSenderUntil(muteKey, muted ? null : Date.now() + AGENT_HUB_SENDER_MUTE_MS)
    },
    {
      key: 'notifications',
      label: t('agentHub.bots.tab.notificationSettings', 'Notification settings…'),
      icon: <Settings className="size-3.5" />,
      onSelect: () => {
        openBotSettingsPage(bot.id)
        onNavigate()
      }
    },
    'separator',
    {
      key: 'settings',
      label: t('agentHub.bots.tab.settings', 'Bot settings'),
      onSelect: () => {
        openBotSettings(bot.id)
        onNavigate()
      }
    }
  ]
  const stateLine = offline
    ? t('agentHub.bots.tab.hostOffline', '{{host}} offline', { host })
    : bot.paused
      ? t('agentHub.bots.tab.paused', 'Paused')
      : summary.ask
        ? summary.ask
        : summary.waiting
          ? t('bots.chats.waiting', 'Waiting for you')
          : summary.replying
            ? t('bots.chats.replying', 'Replying…')
            : needs > 0
              ? null
              : signedOut
                ? t('agentHub.bots.tab.signedOut', 'Signed out of Orca · Slack and events are off')
                : sleeping && !busy
                  ? t('agentHub.bots.tab.asleep', 'Asleep · wakes when asked')
                  : null
  const stateTone =
    signedOut && !offline && !busy ? 'warn' : summary.waiting && !offline ? 'ask' : undefined
  return (
    <BotsContextMenu entries={entries}>
      <div
        data-hub-nav=""
        data-nav-key={navKey}
        data-nav-foldable=""
        data-nav-expanded={expanded}
        data-selected={selected}
        className="group/b flex items-center gap-0.5 rounded-lg hover:bg-accent data-[selected=true]:bg-accent"
      >
        <button
          type="button"
          tabIndex={-1}
          data-nav-toggle=""
          aria-expanded={expanded}
          aria-label={t('agentHub.bots.tab.toggleTree', "Show {{name}}'s chats", {
            name: bot.name
          })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggle}
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            aria-hidden
            className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
          />
        </button>
        <button
          type="button"
          tabIndex={-1}
          data-nav-open=""
          data-agent-hub-bots-row=""
          data-bot-id={bot.id}
          aria-disabled={blocked !== null}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openHome}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-1 text-left',
            (bot.paused || offline) && 'opacity-60'
          )}
        >
          <AgentHubBotFace
            bot={bot}
            details={details}
            live={
              offline ? null : summary.waiting ? 'permission' : summary.replying ? 'working' : null
            }
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                {bot.name}
              </span>
              {multiHost ? <AgentHubBotHostChip label={host} /> : null}
              {summary.unread > 0 ? (
                <span
                  title={t('agentHub.bots.tab.unreadChats', '{{count}} unread', {
                    count: summary.unread
                  })}
                  className="size-1.5 shrink-0 rounded-full bg-status-success"
                />
              ) : null}
            </span>
            {stateLine ? (
              <StateLine text={stateLine} tone={stateTone} />
            ) : (
              <BotRowLineView
                line={line}
                limit={limit}
                fallback={description}
                unread={false}
                now={now}
              />
            )}
          </span>
        </button>
        <span className="hidden items-center group-hover/b:flex group-has-[[data-state=open]]/b:flex">
          <HubRowAction
            label={t('agentHub.bots.tab.newChat', 'New chat')}
            onClick={() => {
              if (!blocked) {
                startBotSideChat(bot)
                onNavigate()
              }
            }}
          >
            <MessageSquarePlus className="size-3.5" />
          </HubRowAction>
          <span data-nav-mirror="">
            <HubRowAction
              label={t('agentHub.bots.mirror', 'Open in mirror')}
              onClick={() => {
                if (!blocked) {
                  void mirrorBotChat(bot, null)
                }
              }}
            >
              <PictureInPicture2 className="size-3.5" />
            </HubRowAction>
          </span>
          <BotsMoreMenu entries={entries} />
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pr-2">
          <AgentHubBotNeedsPill count={needs} />
          {summary.lastActiveAt !== null ? (
            <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums group-hover/b:hidden">
              {formatShortTimeAgo(summary.lastActiveAt)}
            </span>
          ) : null}
        </span>
      </div>
    </BotsContextMenu>
  )
}
