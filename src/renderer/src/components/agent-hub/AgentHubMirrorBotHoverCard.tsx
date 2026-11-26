import { useState } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { AgentHubMirrorBotFace } from './AgentHubMirrorBotFace'
import { DrawerLink } from './AgentHubMirrorDrawerParts'
import { openBotPage } from './agent-hub-bot-page-open'
import {
  agentHubMirrorBotChatName,
  agentHubMirrorBotRuns,
  type AgentHubMirrorBotChat
} from './agent-hub-mirror-bot-chat'
import { showBotChatInOrbOrBots } from './agent-hub-bot-mirror'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function Detail({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="min-w-0 text-foreground/90">{children}</dd>
    </>
  )
}

/** The bot behind a mirror tab: who and which chat, what it runs on and where, and the two ways out. */
export function AgentHubMirrorBotHoverCard({
  target,
  botChat,
  title,
  thread,
  suppressed,
  children
}: {
  target: AgentHubPaneTarget
  botChat: AgentHubMirrorBotChat
  title: string
  thread: AgentPaneThread | null
  suppressed: boolean
  children: React.ReactElement
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { bot, isOrb } = botChat
  const runs = agentHubMirrorBotRuns(bot, thread)
  const host = useAppStore((s) => selectExecutionHostDisplayLabel(s, bot.hostId))
  return (
    <HoverCard openDelay={350} closeDelay={80} open={open && !suppressed} onOpenChange={setOpen}>
      <HoverCardTrigger asChild onPointerDown={() => setOpen(false)}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-72">
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex items-center gap-2.5">
            <AgentHubMirrorBotFace bot={bot} size={28} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-foreground">{bot.name}</div>
              <div className="truncate text-muted-foreground">
                {agentHubMirrorBotChatName(botChat, title)}
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
            <Detail label={translate('agentHub.hover.state', 'State')}>{runs.state}</Detail>
            <Detail label={translate('agentHub.mirror.bot.runsOn', 'Runs on')}>
              {[runs.provider, runs.model].filter(Boolean).join(' · ')}
            </Detail>
            {host ? (
              <Detail label={translate('agentHub.mirror.bot.host', 'Host')}>{host}</Detail>
            ) : null}
          </dl>
          <div className="flex items-center gap-3">
            <DrawerLink onClick={() => void openBotPage(bot)}>
              {translate('agentHub.mirror.bot.openPage', 'Open bot page')}
            </DrawerLink>
            <DrawerLink onClick={() => showBotChatInOrbOrBots(target, botChat)}>
              {isOrb
                ? translate('agentHub.mirror.bot.showInOrb', 'Show in Orb')
                : translate('agentHub.mirror.bot.showInBots', 'Show in Bots')}
            </DrawerLink>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
