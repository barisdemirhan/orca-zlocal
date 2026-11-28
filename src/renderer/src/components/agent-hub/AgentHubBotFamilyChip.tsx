import { useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { BotAvatar } from '../bots/BotAvatar'
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover'
import { HubStateIndicator } from './AgentHubStateMarks'
import { HubCrumb } from './AgentHubInlineLabels'
import { AgentHubBotOriginGlyph, originLabel } from './AgentHubBotMark'
import { AgentHubMirrorChipAlert } from './AgentHubMirrorChipAlert'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import type { AgentHubAlertSide } from './AgentHubAlertStack'
import type { AgentHubAlert, AgentHubRequestAlert, AgentHubThreadAlert } from './agent-hub-alerts'
import { loudestAgentHubFamilyKind, type AgentHubBotFamilyMember } from './agent-hub-bot-family'
import type { Bot } from '../../../../shared/bot-types'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import type { AgentHubTrayItem } from './AgentHubMirrorTray'
import type { AgentHubLocation } from './agent-hub-pane-target'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

type Member = AgentHubBotFamilyMember<AgentHubTrayItem>

function countText(chats: number, workers: number): string {
  const parts: string[] = []
  if (chats > 0) {
    parts.push(
      chats === 1
        ? translate('agentHub.bots.family.chatOne', '1 chat')
        : translate('agentHub.bots.family.chatMany', '{{value0}} chats', { value0: chats })
    )
  }
  if (workers > 0) {
    parts.push(
      workers === 1
        ? translate('agentHub.bots.family.workerOne', '1 worker')
        : translate('agentHub.bots.family.workerMany', '{{value0}} workers', { value0: workers })
    )
  }
  return parts.join(' · ')
}

function StatePill({ kind }: { kind: AgentHubIndicatorKind }): React.JSX.Element | null {
  if (kind === 'ask') {
    return (
      <span className="shrink-0 rounded-full bg-agent-question/15 px-2 py-0.5 text-[11px] font-medium text-agent-question">
        {translate('agentHub.bots.family.asks', 'Asks')}
      </span>
    )
  }
  return kind === 'idle' ? null : <HubStateIndicator kind={kind} />
}

function FamilyRow({
  member,
  onRestore
}: {
  member: Member
  onRestore: () => void
}): React.JSX.Element {
  const { item, identity } = member
  const title = useAgentHubTargetTitle(activeAgentHubMirrorTab(item.chip.window).target)
  const worker = identity.origin === 'worker'
  return (
    <button
      type="button"
      data-agent-hub-bot-family-row
      data-kind={worker ? 'worker' : 'chat'}
      onClick={onRestore}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none"
    >
      <AgentHubBotOriginGlyph
        origin={identity.origin}
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 text-xs leading-tight">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground [&>span]:text-[11px]">
          {worker ? <HubCrumb location={item.location} /> : originLabel(identity.origin)}
        </span>
      </span>
      <StatePill kind={item.kind} />
    </button>
  )
}

function FamilySection({
  label,
  members,
  onRestore
}: {
  label: string
  members: readonly Member[]
  onRestore: (key: string) => void
}): React.JSX.Element | null {
  if (members.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 pt-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      {members.map((member) => (
        <FamilyRow
          key={member.item.key}
          member={member}
          onRestore={() => onRestore(member.item.key)}
        />
      ))}
    </div>
  )
}

/** One chip for a bot whose chats and workers are parked: the list below restores one at a time. */
export function AgentHubBotFamilyChip({
  bot,
  members,
  alertSide,
  alertsHidden,
  locationOfAlert,
  requestPresentationOf,
  onRestore,
  onReveal,
  onClose,
  onOpenAlert,
  onDismissAlert
}: {
  bot: Bot
  members: readonly Member[]
  alertSide: AgentHubAlertSide
  alertsHidden: boolean
  locationOfAlert?: (alert: AgentHubThreadAlert | AgentHubRequestAlert) => AgentHubLocation
  requestPresentationOf?: (alert: AgentHubRequestAlert) => AgentHubRequestPresentation
  onRestore: (key: string) => void
  onReveal: (item: AgentHubTrayItem, alert?: AgentHubAlert) => void
  onClose: (key: string) => void
  onOpenAlert: (key: string, alert: AgentHubAlert) => void
  onDismissAlert: (id: string) => void
}): React.JSX.Element {
  const chipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const kind = loudestAgentHubFamilyKind(members.map((member) => member.item.kind))
  const chats = members.filter((member) => member.identity.origin !== 'worker')
  const workers = members.filter((member) => member.identity.origin === 'worker')
  const alertMember = members.find((member) => member.item.alert)
  const alert = alertsHidden ? null : (alertMember?.item.alert ?? null)
  const toggle = (): void => setOpen((current) => !current)
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={chipRef}
            role="button"
            tabIndex={0}
            aria-expanded={open}
            aria-label={translate('agentHub.bots.family.toggle', "{{name}}'s parked chats", {
              name: bot.name
            })}
            data-agent-hub-bot-family
            data-bot-id={bot.id}
            data-count={members.length}
            data-kind={kind}
            onClick={(event) => {
              if (!(event.target instanceof Element && event.target.closest('button'))) {
                toggle()
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggle()
              }
            }}
            className="group/chip flex h-10 w-70 shrink-0 animate-in cursor-pointer items-center gap-2 rounded-xl border border-foreground/20 bg-popover pr-1 pl-2 text-popover-foreground shadow-floating duration-200 select-none fade-in-0 zoom-in-95 hover:border-foreground/35 data-[kind=ask]:border-agent-question/60 data-[kind=ask]:bg-linear-to-r data-[kind=ask]:from-agent-question/10 data-[kind=ask]:to-agent-question/10 data-[kind=done]:border-status-success/50 motion-reduce:animate-none!"
          >
            <HubStateIndicator kind={kind} />
            <BotAvatar
              bot={bot}
              className="size-6.5 shrink-0 rounded-lg text-[11px] ring-2 ring-transparent group-data-[kind=ask]/chip:ring-agent-question group-data-[kind=done]/chip:ring-status-success group-data-[kind=work]/chip:ring-status-warning"
            />
            <span className="min-w-0 flex-1 text-xs leading-tight">
              <span className="block truncate font-semibold">{bot.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {countText(chats.length, workers.length)}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              data-open={open}
              className="size-3.5 shrink-0 text-muted-foreground transition-transform data-[open=true]:rotate-180"
            />
            <button
              type="button"
              aria-label={translate('agentHub.bots.family.close', 'Close all of {{name}}', {
                name: bot.name
              })}
              title={translate('agentHub.bots.family.close', 'Close all of {{name}}', {
                name: bot.name
              })}
              onClick={() => members.forEach((member) => onClose(member.item.key))}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          data-agent-hub-bot-family-list
          side={alertSide}
          align="start"
          sideOffset={8}
          wheelScroll
          className="flex max-h-80 w-70 flex-col gap-1 overflow-y-auto p-1.5 scrollbar-sleek"
        >
          <FamilySection
            label={translate('agentHub.bots.family.chats', 'Chats')}
            members={chats}
            onRestore={(key) => {
              setOpen(false)
              onRestore(key)
            }}
          />
          <FamilySection
            label={translate('agentHub.bots.family.workers', 'Workers')}
            members={workers}
            onRestore={(key) => {
              setOpen(false)
              onRestore(key)
            }}
          />
        </PopoverContent>
      </Popover>
      {alert && alertMember ? (
        <AgentHubMirrorChipAlert
          alert={alert}
          anchorRef={chipRef}
          alertSide={alertSide}
          location={alertMember.item.location}
          locationOfAlert={locationOfAlert}
          requestPresentationOf={requestPresentationOf}
          onOpenAlert={(shown) => onOpenAlert(alertMember.item.key, shown)}
          onDismissAlert={onDismissAlert}
          onReveal={(shown) => onReveal(alertMember.item, shown)}
        />
      ) : null}
    </>
  )
}
