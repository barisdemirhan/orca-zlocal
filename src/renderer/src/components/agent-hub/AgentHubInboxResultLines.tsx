import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { Button } from '@/components/ui/button'
import { dismissSuggestion, startSuggestion } from '../bots/bot-up-next-actions'
import { HubChip } from './AgentHubInlineLabels'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import { AgentHubInboxDot, AgentHubInboxLink, AgentHubInboxTime } from './AgentHubInboxParts'
import type { AgentHubInboxItem } from './agent-hub-inbox-model'
import { agentHubInboxEntryGist } from './agent-hub-inbox-sender'

function paneKeysOf(entries: readonly AgentHubInboxItem[]): string[] {
  return entries.flatMap(({ payload }) =>
    payload.type === 'finished' ? [payload.thread.paneKey] : []
  )
}

/** A sender's finished work as one line (failures first) that opens onto the earlier results. */
export function AgentHubInboxResultsLine({
  entries,
  context
}: {
  entries: readonly AgentHubInboxItem[]
  context: AgentHubInboxEntryContext
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [lead] = entries
  if (!lead) {
    return null
  }
  const failedLead = lead.kind === 'fail'
  return (
    <div data-agent-hub-results data-agent-hub-fail={failedLead} className="group/results">
      <div className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-foreground/[0.05]">
        <AgentHubInboxDot kind={failedLead ? 'fail' : 'done'} />
        <button
          type="button"
          tabIndex={-1}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-w-0 flex-1 truncate text-left"
        >
          {failedLead ? (
            <span className="text-destructive">
              {translate('agentHub.inbox.failedPrefix', 'Failed · ')}
            </span>
          ) : null}
          {agentHubInboxEntryGist(lead)}
        </button>
        {entries.length > 1 ? <HubChip>{entries.length}</HubChip> : null}
        <span className="hidden items-center gap-2 group-hover/results:flex">
          <AgentHubInboxLink onClick={() => context.onOpenEntry(lead, false)}>
            {translate('agentHub.inbox.open', 'Open')}
          </AgentHubInboxLink>
          <button
            type="button"
            tabIndex={-1}
            title={translate('agentHub.inbox.markRead', 'Mark read')}
            onClick={() => context.onMarkRead(paneKeysOf(entries))}
            className="text-muted-foreground hover:text-foreground"
          >
            <Check className="size-3.5" />
          </button>
        </span>
        <AgentHubInboxTime since={lead.since} now={context.now} />
      </div>
      {open ? (
        <div className="flex flex-col gap-1 pb-1 pl-6 text-xs text-muted-foreground">
          {entries.slice(1).map((entry) => (
            <span
              key={entry.id}
              data-failed={entry.kind === 'fail'}
              className="truncate data-[failed=true]:text-destructive"
            >
              {agentHubInboxEntryGist(entry)}
            </span>
          ))}
          <span className="flex gap-3">
            <AgentHubInboxLink onClick={() => context.onOpenEntry(lead, false)}>
              {translate('agentHub.inbox.openChat', 'Open chat')}
            </AgentHubInboxLink>
            <AgentHubInboxLink onClick={() => context.onOpenEntry(lead, true)}>
              {translate('agentHub.inbox.reply', 'Reply')}
            </AgentHubInboxLink>
            <AgentHubInboxLink onClick={() => context.onMarkRead(paneKeysOf(entries))}>
              {translate('agentHub.inbox.markRead', 'Mark read')}
            </AgentHubInboxLink>
          </span>
        </div>
      ) : null}
    </div>
  )
}

/** A sender's suggestions folded into one line; opened, each one has Yes and Dismiss. */
export function AgentHubInboxSuggestionsLine({
  entries
}: {
  entries: readonly AgentHubInboxItem[]
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (entries.length === 0) {
    return null
  }
  return (
    <div data-agent-hub-suggestions>
      <button
        type="button"
        tabIndex={-1}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-foreground/[0.05]"
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3 transition-transform', open && 'rotate-90')}
        />
        {entries.length === 1
          ? translate('agentHub.inbox.suggestionOne', '1 suggestion')
          : translate('agentHub.inbox.suggestionMany', '{{count}} suggestions', {
              count: entries.length
            })}
      </button>
      {open
        ? entries.map(({ id, payload }) =>
            payload.type === 'suggestion' ? (
              <div key={id} className="flex items-center gap-2 py-1 pr-2 pl-6 text-[13px]">
                <span className="min-w-0 flex-1">{payload.suggestion.title}</span>
                <Button
                  size="xs"
                  onClick={() => void startSuggestion(payload.bot, payload.suggestion.id)}
                >
                  {translate('agentHub.botBubble.suggestionYes', 'Yes')}
                </Button>
                <AgentHubInboxLink
                  onClick={() => void dismissSuggestion(payload.bot, payload.suggestion.id)}
                >
                  {translate('agentHub.botBubble.suggestionDismiss', 'Dismiss')}
                </AgentHubInboxLink>
              </div>
            ) : null
          )
        : null}
    </div>
  )
}
