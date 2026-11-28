import { useState } from 'react'
import { Check, ChevronRight, CornerDownLeft, PictureInPicture2, Reply } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { Button } from '@/components/ui/button'
import { dismissSuggestion, startSuggestion } from '../bots/bot-up-next-actions'
import { HubChip } from './AgentHubInlineLabels'
import { AgentHubResultReplyInput } from './AgentHubResultReplyInput'
import { HubRowAction } from './AgentHubRowActions'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import { AgentHubInboxDot, AgentHubInboxLink, AgentHubInboxTime } from './AgentHubInboxParts'
import type { AgentHubInboxItem } from './agent-hub-inbox-model'
import { agentHubInboxEntryGist } from './agent-hub-inbox-sender'

function paneKeysOf(entries: readonly AgentHubInboxItem[]): string[] {
  return entries.flatMap(({ payload }) =>
    payload.type === 'finished' ? [payload.thread.paneKey] : []
  )
}

function fullMessageOf(entry: AgentHubInboxItem): string | null {
  const { payload } = entry
  if (payload.type !== 'finished') {
    return null
  }
  const entryMessage = payload.thread.paneEntry ?? payload.thread.latestEvent?.entry
  return entryMessage?.lastAssistantMessageIsToolOutput
    ? null
    : (entryMessage?.lastAssistantMessage?.trim() ?? null)
}

/** A sender's finished work as one line (failures first); the row opens onto the full text and earlier results. */
export function AgentHubInboxResultsLine({
  entries,
  context,
  selected
}: {
  entries: readonly AgentHubInboxItem[]
  context: AgentHubInboxEntryContext
  selected: boolean
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [replying, setReplying] = useState(false)
  const [lead] = entries
  if (!lead) {
    return null
  }
  const failedLead = lead.kind === 'fail'
  const full = fullMessageOf(lead)
  const showActions = selected || open
  const replyThread = lead.payload.type === 'finished' ? lead.payload.thread : null
  return (
    <div data-agent-hub-results data-agent-hub-fail={failedLead} className="group/results">
      <div
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-foreground/[0.05]"
      >
        <AgentHubInboxDot kind={failedLead ? 'fail' : 'done'} />
        <span className={cn('min-w-0 flex-1', !open && 'truncate')}>
          {failedLead ? (
            <span className="text-destructive">
              {translate('agentHub.inbox.failedPrefix', 'Failed · ')}
            </span>
          ) : null}
          {agentHubInboxEntryGist(lead)}
        </span>
        {entries.length > 1 ? <HubChip>{entries.length}</HubChip> : null}
        <span
          className={cn(
            'items-center gap-0.5',
            showActions ? 'flex' : 'hidden group-hover/results:flex'
          )}
        >
          <HubRowAction
            actionId="agentHub.popOut"
            label={translate('agentHub.row.popOut', 'Pop out')}
            onClick={() => context.onOpenEntry(lead, true)}
          >
            <PictureInPicture2 className="size-3.5" />
          </HubRowAction>
          {replyThread ? (
            <HubRowAction
              label={translate('agentHub.inbox.reply', 'Reply')}
              onClick={() => {
                setOpen(true)
                setReplying(true)
              }}
            >
              <Reply className="size-3.5" />
            </HubRowAction>
          ) : null}
          <HubRowAction
            label={translate('agentHub.inbox.markRead', 'Mark read')}
            onClick={() => context.onMarkRead(paneKeysOf(entries))}
          >
            <Check className="size-3.5" />
          </HubRowAction>
          <HubRowAction
            label={translate('agentHub.row.jump', 'Jump to this terminal')}
            onClick={() => context.onOpenEntry(lead, false)}
          >
            <CornerDownLeft className="size-3.5" />
          </HubRowAction>
        </span>
        <AgentHubInboxTime
          since={lead.since}
          now={context.now}
          className={showActions ? 'hidden' : 'group-hover/results:hidden'}
        />
      </div>
      {open && replying && replyThread ? (
        <AgentHubResultReplyInput
          thread={replyThread}
          onDone={() => {
            setReplying(false)
            setOpen(false)
          }}
          onCancel={() => setReplying(false)}
        />
      ) : null}
      {open ? (
        <div className="flex flex-col gap-1.5 pr-2 pb-2 pl-6 text-xs leading-5">
          {full ? <p className="text-[13px] text-foreground/85">{full}</p> : null}
          {entries.length > 1 ? (
            <>
              <p className="text-[11px] tracking-[0.04em] text-muted-foreground/70 uppercase">
                {translate('agentHub.inbox.earlierResults', 'Earlier results')}
              </p>
              {entries.slice(1).map((entry) => (
                <span
                  key={entry.id}
                  data-failed={entry.kind === 'fail'}
                  className="truncate text-muted-foreground data-[failed=true]:text-destructive"
                >
                  {agentHubInboxEntryGist(entry)}
                </span>
              ))}
            </>
          ) : null}
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
