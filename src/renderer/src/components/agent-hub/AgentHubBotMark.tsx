import { useMemo } from 'react'
import {
  Clock,
  Cpu,
  GitPullRequest,
  Home,
  ListTodo,
  MessageSquare,
  MessagesSquare,
  type LucideIcon
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useBotHomeWorkspaces } from '@/lib/bot-catalog'
import { BotAvatar } from '../bots/BotAvatar'
import { BotRowLineText, useBotRowLine } from '../bots/BotRowActivityLine'
import type { Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import type { AgentHubBotIdentity, AgentHubBotOrigin } from './agent-hub-bot-identity'

const ORIGIN_GLYPHS: Record<AgentHubBotOrigin, LucideIcon> = {
  home: Home,
  github: GitPullRequest,
  slack: MessageSquare,
  linear: ListTodo,
  automation: Clock,
  side: MessagesSquare,
  worker: Cpu
}

const NO_GROUPS: readonly Bot[] = []

export function AgentHubBotOriginGlyph({
  origin,
  className
}: {
  origin: AgentHubBotOrigin
  className?: string
}): React.JSX.Element {
  const Glyph = ORIGIN_GLYPHS[origin]
  return <Glyph aria-hidden className={className} />
}

export function originLabel(origin: AgentHubBotOrigin): string {
  switch (origin) {
    case 'home':
      return translate('agentHub.bots.origin.home', 'Home chat')
    case 'github':
      return translate('agentHub.bots.origin.github', 'From GitHub')
    case 'slack':
      return translate('agentHub.bots.origin.slack', 'From Slack')
    case 'linear':
      return translate('agentHub.bots.origin.linear', 'From Linear')
    case 'automation':
      return translate('agentHub.bots.origin.automation', 'From an automation')
    case 'side':
      return translate('agentHub.bots.origin.side', 'Side chat')
    case 'worker':
      return translate('agentHub.bots.origin.worker', 'Worker')
  }
}

/** The bot's face at the size of a hub avatar, with a corner glyph for where its work began. */
export function AgentHubBotAvatar({
  identity
}: {
  identity: AgentHubBotIdentity
}): React.JSX.Element {
  const Glyph = ORIGIN_GLYPHS[identity.origin]
  return (
    <span
      data-agent-hub-bot-avatar
      data-origin={identity.origin}
      title={originLabel(identity.origin)}
      className="relative grid size-6.5 shrink-0 place-items-center"
    >
      <BotAvatar bot={identity.bot} className="size-6.5 rounded-lg text-[11px]" />
      <span
        aria-hidden
        className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-popover text-muted-foreground ring-1 ring-border"
      >
        <Glyph className="size-2.5" />
      </span>
    </span>
  )
}

function BotLineText({ bot, home }: { bot: Bot; home: FolderWorkspace }): React.JSX.Element {
  const { line, limit, now } = useBotRowLine(bot, home)
  return <BotRowLineText line={line} limit={limit} now={now} />
}

/** What the bot is doing, as its sidebar row says it; nothing while its home is not listed. */
export function AgentHubBotLine({ bot }: { bot: Bot }): React.JSX.Element | null {
  const owners = useMemo(() => [bot], [bot])
  const [home] = useBotHomeWorkspaces(owners, NO_GROUPS)
  return home ? <BotLineText bot={bot} home={home} /> : null
}
