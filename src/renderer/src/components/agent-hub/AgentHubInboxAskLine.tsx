import type { Ref } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import type { AgentHubCardControl } from './AgentHubAttentionCard'
import { AgentHubInboxContextMenu } from './AgentHubInboxMenu'
import { HubChip } from './AgentHubInlineLabels'
import { originLabel } from './AgentHubBotMark'
import { AgentHubInboxEntryView, type AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import { AgentHubInboxDot, AgentHubInboxTime } from './AgentHubInboxParts'
import { agentHubInboxAskMenu } from './agent-hub-inbox-menus'
import type { AgentHubInboxItem } from './agent-hub-inbox-model'
import { agentHubInboxEntryGist, agentHubInboxEntryTag } from './agent-hub-inbox-sender'
import type { AgentHubBotOrigin } from './agent-hub-bot-identity'

function workerChipText(entry: AgentHubInboxItem): string | null {
  const { payload } = entry
  if (entry.origin === 'worker' && payload.type === 'thread') {
    return translate('agentHub.inbox.workerChip', 'worker · {{agent}}', {
      agent: formatAgentTypeLabel(payload.thread.agentType).toLowerCase()
    })
  }
  return entry.workerOf
    ? translate('agentHub.inbox.workerOf', 'worker of {{agent}}', { agent: entry.workerOf })
    : null
}

function tagText(entry: AgentHubInboxItem): string | null {
  const tag = agentHubInboxEntryTag(entry)
  switch (tag?.type) {
    case 'approval':
      return translate('agentHub.inbox.tag.approval', 'approval')
    case 'signin':
      return translate('agentHub.inbox.tag.signIn', 'sign in')
    case 'steps':
      return `1/${tag.total}`
    default:
      return null
  }
}

function Chips({
  entry,
  withTag
}: {
  entry: AgentHubInboxItem
  withTag: boolean
}): React.JSX.Element {
  const tag = withTag ? tagText(entry) : null
  const worker = workerChipText(entry)
  return (
    <>
      {tag ? <HubChip tone="ask">{tag}</HubChip> : null}
      {worker ? <HubChip>{worker}</HubChip> : null}
    </>
  )
}

function Caption({
  entry,
  context,
  onFold
}: {
  entry: AgentHubInboxItem
  context: AgentHubInboxEntryContext
  onFold: () => void
}): React.JSX.Element {
  const { payload } = entry
  const number = payload.type === 'bot-item' ? payload.item.number : null
  const chatName = payload.type === 'bot-item' ? payload.item.chat.title : null
  const origin =
    entry.origin === 'side' && chatName
      ? chatName
      : entry.origin
        ? originLabel(entry.origin as AgentHubBotOrigin)
        : null
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onFold}
      className="mb-1 flex w-full min-w-0 items-center gap-2 px-2 pt-1 text-left text-xs text-muted-foreground"
    >
      <AgentHubInboxDot kind="ask" />
      <span className="min-w-0 flex-1 truncate">
        {number !== null ? <span className="font-mono">#{number} </span> : null}
        {origin}
      </span>
      <Chips entry={entry} withTag={false} />
      <AgentHubInboxTime since={entry.since} now={context.now} />
    </button>
  )
}

/** One question of a sender: a line when folded, the answer card under a caption when active. */
export function AgentHubInboxAskLine({
  entry,
  active,
  offline,
  context,
  controlRef,
  onActivate
}: {
  entry: AgentHubInboxItem
  active: boolean
  offline: boolean
  context: AgentHubInboxEntryContext
  controlRef?: Ref<AgentHubCardControl>
  onActivate: (fold: boolean) => void
}): React.JSX.Element {
  const { payload } = entry
  const remaining = payload.type === 'bot-item' ? payload.remaining : null
  const plainBotAsk = payload.type === 'bot-item' && !payload.item.question
  const menu = agentHubInboxAskMenu(entry, context, () => onActivate(false))
  if (active) {
    return (
      <AgentHubInboxContextMenu items={menu}>
        <div
          data-agent-hub-ask-card
          className={cn(
            'rounded-xl border p-1.5',
            offline
              ? 'border-foreground/[0.06] opacity-75'
              : 'border-foreground/[0.08] bg-foreground/[0.035]'
          )}
        >
          {remaining === null && !plainBotAsk ? (
            <Caption entry={entry} context={context} onFold={() => onActivate(true)} />
          ) : null}
          <AgentHubInboxEntryView entry={entry} context={context} controlRef={controlRef} />
        </div>
      </AgentHubInboxContextMenu>
    )
  }
  return (
    <AgentHubInboxContextMenu items={menu}>
      <button
        type="button"
        tabIndex={-1}
        data-agent-hub-ask-line
        onClick={() => onActivate(false)}
        className={cn(
          'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-foreground/[0.05]',
          offline && 'opacity-60'
        )}
      >
        <AgentHubInboxDot kind="ask" />
        <span className="min-w-0 flex-1 truncate">
          {remaining !== null
            ? remaining === 1
              ? translate('agentHub.inbox.partialOpenOne', '1 question still open')
              : translate('agentHub.inbox.partialOpenMany', '{{count}} questions still open', {
                  count: remaining
                })
            : agentHubInboxEntryGist(entry)}
        </span>
        {remaining !== null ? (
          <span className="shrink-0 text-xs font-medium text-agent-question">
            {translate('agentHub.inbox.partialAnswer', 'Answer')}
          </span>
        ) : null}
        <Chips entry={entry} withTag={remaining === null} />
        <AgentHubInboxTime since={entry.since} now={context.now} />
      </button>
    </AgentHubInboxContextMenu>
  )
}
