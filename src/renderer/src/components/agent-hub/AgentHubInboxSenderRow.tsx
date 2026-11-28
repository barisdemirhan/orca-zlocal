import { MoreHorizontal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { useBotHostOffline } from '@/lib/bot-host-views'
import { useBotHostLabel } from '../bots/use-bot-host-label'
import type { AgentHubCardControl } from './AgentHubAttentionCard'
import { AgentHubInboxAskLine } from './AgentHubInboxAskLine'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import { AgentHubInboxContextMenu, AgentHubInboxMoreMenu } from './AgentHubInboxMenu'
import { AgentHubInboxFace, type AgentHubInboxDotKind } from './AgentHubInboxParts'
import { AgentHubInboxResultsLine, AgentHubInboxSuggestionsLine } from './AgentHubInboxResultLines'
import { HubChip } from './AgentHubInlineLabels'
import { agentHubInboxSenderMenu, agentHubInboxSenderMuteKey } from './agent-hub-inbox-menus'
import { useAgentHubSenderMuted } from './agent-hub-sender-mute'
import type { AgentHubInboxItemGroup } from './agent-hub-inbox-model'
import { agentHubInboxEntryGist, agentHubInboxSender } from './agent-hub-inbox-sender'

function dotOf(group: AgentHubInboxItemGroup): AgentHubInboxDotKind | null {
  if (group.asks.length > 0) {
    return 'ask'
  }
  if (group.fails.length > 0) {
    return 'fail'
  }
  return group.results.length > 0 ? 'done' : null
}

/**
 * One sender: its face and name, then every question it has as a line, the active one as the answer
 * card, then its finished work and suggestions folded into one line each.
 */
export function AgentHubInboxSenderRow({
  group,
  selected,
  open,
  activeId,
  onSelect,
  onToggle,
  onActivate,
  context,
  controlRef
}: {
  group: AgentHubInboxItemGroup
  selected: boolean
  open: boolean
  /** The question shown as a card; the oldest unless one was picked. */
  activeId: string | null
  onSelect: () => void
  onToggle: () => void
  onActivate: (entryId: string, fold: boolean) => void
  context: AgentHubInboxEntryContext
  controlRef: React.Ref<AgentHubCardControl> | null
}): React.JSX.Element {
  const sender = agentHubInboxSender(group, context.actions.locationOf)
  const offline = useBotHostOffline(sender.hostId)
  const hostLabel = useBotHostLabel(sender.hostId) ?? sender.hostChip
  const offlineLabel = offline
    ? hostLabel
      ? translate('agentHub.inbox.hostOffline', '{{host}} offline', { host: hostLabel })
      : translate('agentHub.inbox.offline', 'offline')
    : null
  const muteKey = agentHubInboxSenderMuteKey(sender)
  const muted = useAgentHubSenderMuted(muteKey)
  const menu = agentHubInboxSenderMenu(group, sender, context, muted)
  const kind = dotOf(group)
  const finished = group.fails.length + group.results.length
  const lead = group.asks[0] ?? group.fails[0] ?? group.results[0] ?? group.suggestions[0]
  const faceSize = sender.bot ? 'pl-[42px]' : 'pl-[36px]'
  return (
    <div
      data-agent-hub-sender
      data-agent-hub-group={group.key}
      data-selected={selected}
      data-offline={offline}
    >
      <AgentHubInboxContextMenu items={menu}>
        <div
          className={cn(
            'group/head flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-foreground/[0.05]',
            selected && 'bg-foreground/[0.05]'
          )}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-expanded={open}
            onClick={() => {
              onSelect()
              onToggle()
            }}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <AgentHubInboxFace
              bot={sender.bot}
              agentType={sender.thread?.agentType ?? null}
              kind={kind}
            />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-[13px] font-medium">{sender.name}</span>
                {sender.handle ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{sender.handle}</span>
                ) : null}
                {sender.hostChip ? <HubChip>{sender.hostChip}</HubChip> : null}
                {offlineLabel ? <HubChip>{offlineLabel}</HubChip> : null}
              </span>
              {open || !lead ? null : (
                <span className="block truncate text-xs text-muted-foreground">
                  {agentHubInboxEntryGist(lead)}
                </span>
              )}
            </span>
          </button>
          <span className="hidden group-hover/head:flex">
            <AgentHubInboxMoreMenu
              items={menu}
              label={translate('agentHub.inbox.senderMenu', '{{name}} menu', {
                name: sender.name
              })}
            >
              <MoreHorizontal className="size-3.5" />
            </AgentHubInboxMoreMenu>
          </span>
          {group.asks.length > 0 ? (
            <span className="shrink-0 rounded-full bg-agent-question px-1.5 text-[10px] leading-4 font-semibold text-white">
              {group.asks.length}
            </span>
          ) : finished > 0 ? (
            <span className="shrink-0 rounded-full bg-foreground/[0.08] px-1.5 text-[10px] leading-4 font-semibold text-muted-foreground">
              {finished}
            </span>
          ) : null}
        </div>
      </AgentHubInboxContextMenu>
      {open ? (
        // Why a fieldset: an offline host keeps its options visible and typed text kept, but disabled.
        <fieldset
          disabled={offline}
          className={cn('flex min-w-0 flex-col gap-0.5 border-0 p-0', faceSize)}
        >
          {group.asks.map((entry) => (
            <AgentHubInboxAskLine
              key={entry.id}
              entry={entry}
              active={entry.id === activeId}
              offline={offline}
              context={context}
              controlRef={entry.id === activeId ? (controlRef ?? undefined) : undefined}
              onActivate={(fold) => onActivate(entry.id, fold)}
            />
          ))}
          <AgentHubInboxResultsLine
            entries={[...group.fails, ...group.results]}
            context={context}
            selected={selected}
          />
          <AgentHubInboxSuggestionsLine entries={group.suggestions} />
        </fieldset>
      ) : null}
    </div>
  )
}
