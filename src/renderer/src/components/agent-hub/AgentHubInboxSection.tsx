import { ChevronDown } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import { AgentHubInboxMiniFace } from './AgentHubInboxParts'
import { AgentHubInboxSenderRow } from './AgentHubInboxSenderRow'
import type { AgentHubInboxItemGroup } from './agent-hub-inbox-model'
import { agentHubInboxSender } from './agent-hub-inbox-sender'
import type { AgentHubInboxView } from './use-agent-hub-inbox-view'

const MAX_FACES = 5

/** One bordered card per side (Bots, Agents): header with faces and counts, then its senders. */
export function AgentHubInboxSection({
  side,
  groups,
  folded,
  onToggleFold,
  view,
  context
}: {
  side: 'bots' | 'agents'
  groups: readonly AgentHubInboxItemGroup[]
  folded: boolean
  onToggleFold: () => void
  view: AgentHubInboxView
  context: AgentHubInboxEntryContext
}): React.JSX.Element {
  const waiting = groups.reduce((sum, group) => sum + group.asks.length, 0)
  const finished = groups.reduce((sum, group) => sum + group.fails.length + group.results.length, 0)
  const title =
    side === 'bots'
      ? translate('agentHub.inbox.side.bots', 'Bots')
      : translate('agentHub.inbox.side.agents', 'Agents')
  return (
    <section
      data-agent-hub-box={side}
      className="mb-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.015]"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-expanded={!folded}
        onClick={onToggleFold}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 text-muted-foreground transition-transform',
            folded && '-rotate-90'
          )}
        />
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="flex -space-x-1.5">
          {groups.slice(0, MAX_FACES).map((group) => {
            const sender = agentHubInboxSender(group, context.actions.locationOf)
            return (
              <AgentHubInboxMiniFace
                key={group.key}
                bot={sender.bot}
                agentType={sender.thread?.agentType ?? null}
              />
            )
          })}
        </span>
        <span className="flex-1" />
        {waiting > 0 ? (
          <span className="text-xs font-medium text-agent-question">
            {translate('agentHub.inbox.waitingCount', '{{count}} waiting', { count: waiting })}
          </span>
        ) : null}
        {finished > 0 ? (
          <span className="text-xs text-muted-foreground">
            {translate('agentHub.inbox.finishedCount', '{{count}} finished', { count: finished })}
          </span>
        ) : null}
      </button>
      {folded ? null : (
        <div className="px-1.5 pb-1.5">
          {groups.map((group) => (
            <AgentHubInboxSenderRow
              key={group.key}
              group={group}
              selected={view.selectedKey === group.key}
              open={view.isOpen(group.key)}
              activeId={view.activeAskId(group)}
              onSelect={() => view.select(group.key)}
              onToggle={() => view.toggle(group.key)}
              onActivate={(entryId, fold) => view.activateAsk(group, entryId, fold)}
              context={context}
              controlRef={view.selectedKey === group.key ? view.controlRef : null}
            />
          ))}
        </div>
      )}
    </section>
  )
}
