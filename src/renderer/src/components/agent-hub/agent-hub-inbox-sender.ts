import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { botConnectorTitleText } from '../bots/bot-connector-titles'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import type { Bot } from '../../../../shared/bot-types'
import {
  LOCAL_EXECUTION_HOST_ID,
  type ExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import { agentHubIsApproval } from './agent-hub-lists'
import type { AgentHubLocation } from './agent-hub-pane-target'
import type { AgentHubInboxItem, AgentHubInboxItemGroup } from './agent-hub-inbox-model'
import type { AgentHubInboxRequest } from './agent-hub-requests-store'

function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const end = flat.search(/[.!?](\s|$)/)
  return agentHubMessageSummary(end > 0 ? flat.slice(0, end + 1) : flat)
}

/** What a hub request says: its question, or its notice. */
export function agentHubInboxRequestText(item: AgentHubInboxRequest): string {
  const { request } = item
  switch (request.kind) {
    case 'ask':
    case 'gate':
      return request.question
    case 'notify':
      return request.text
    case 'consent':
      return request.caller.title ?? ''
  }
}

export type AgentHubInboxSender = {
  /** Bots by name; agents by project · workspace (a folder workspace by its folder name). */
  name: string
  /** "@claude" for an agent. */
  handle: string | null
  bot: Bot | null
  thread: AgentPaneThread | null
  hostId: ExecutionHostId
  /** The machine's name, only when workspaces span several hosts. */
  hostChip: string | null
}

type LocationOf = (thread: AgentPaneThread) => AgentHubLocation

/** Who the group is, from its first entry. */
export function agentHubInboxSender(
  group: AgentHubInboxItemGroup,
  locationOf: LocationOf
): AgentHubInboxSender {
  const entries = [...group.asks, ...group.fails, ...group.results, ...group.suggestions]
  const owner = entries.find((entry) => entry.bot)?.bot
  const payload = (owner ? undefined : entries[0])?.payload
  const none = {
    bot: null,
    thread: null,
    hostId: LOCAL_EXECUTION_HOST_ID as ExecutionHostId,
    hostChip: null
  }
  if (owner) {
    return { ...none, name: owner.name, handle: null, bot: owner, hostId: owner.hostId }
  }
  switch (payload?.type) {
    case 'bot-item':
    case 'connector':
    case 'access':
    case 'suggestion':
      return {
        ...none,
        name: payload.bot.name,
        handle: null,
        bot: payload.bot,
        hostId: payload.bot.hostId
      }
    case 'thread':
    case 'finished': {
      const { thread } = payload
      const location = locationOf(thread)
      return {
        name: location.workspace ? `${location.project} · ${location.workspace}` : location.project,
        handle: `@${formatAgentTypeLabel(thread.agentType).toLowerCase()}`,
        bot: null,
        thread,
        hostId: thread.worktree.hostId ?? LOCAL_EXECUTION_HOST_ID,
        hostChip: location.host ?? null
      }
    }
    case 'request': {
      const { caller } = payload.item.request
      return {
        ...none,
        name: caller.kind === 'orb' ? 'Orb' : (caller.title ?? caller.terminalHandle),
        handle: caller.agentType ? `@${caller.agentType}` : null
      }
    }
    default:
      return { ...none, name: '', handle: null }
  }
}

/** What one entry says in one line: the question's gist, or the finished work's first sentence. */
export function agentHubInboxEntryGist(entry: AgentHubInboxItem): string {
  const { payload } = entry
  switch (payload.type) {
    case 'bot-item':
      return payload.item.question?.gist ?? payload.item.question?.text ?? payload.item.title
    case 'thread':
      return activityThreadRowCopy(payload.thread).taskTitle
    case 'finished': {
      const entryMessage = payload.thread.paneEntry ?? payload.thread.latestEvent?.entry
      const message = entryMessage?.lastAssistantMessageIsToolOutput
        ? undefined
        : entryMessage?.lastAssistantMessage?.trim()
      return message ? firstSentence(message) : activityThreadRowCopy(payload.thread).taskTitle
    }
    case 'suggestion':
      return payload.suggestion.title
    case 'request':
      return agentHubMessageSummary(
        agentHubInboxRequestText(payload.item) || payload.item.request.caller.title || ''
      )
    case 'connector':
      return translate('agentHub.botBubble.signIn', 'Sign in to {{value0}} so I can keep going.', {
        value0: botConnectorTitleText(payload.connector.title)
      })
    case 'access':
      return translate(
        'agentHub.botBubble.access',
        '{{value0}} asks to talk to me on {{value1}}.',
        {
          value0: payload.request.requester.name || payload.request.requester.handle,
          value1: payload.request.workspaceName
        }
      )
  }
}

export type AgentHubInboxTag = { type: 'approval' | 'signin' } | { type: 'steps'; total: number }

/** The small status chip a folded ask carries: steps, approval or sign-in. */
export function agentHubInboxEntryTag(entry: AgentHubInboxItem): AgentHubInboxTag | null {
  const { payload } = entry
  switch (payload.type) {
    case 'connector':
      return { type: 'signin' }
    case 'access':
      return { type: 'approval' }
    case 'request':
      return payload.item.request.kind === 'consent' ? { type: 'approval' } : null
    case 'thread':
      return agentHubIsApproval(payload.thread) ? { type: 'approval' } : null
    case 'bot-item': {
      const total = payload.item.question?.decisions?.length ?? 0
      return total > 1 ? { type: 'steps', total } : null
    }
    default:
      return null
  }
}

export function agentHubInboxGroupSince(group: AgentHubInboxItemGroup): number | null {
  const first = group.asks[0] ?? group.fails[0] ?? group.results[0] ?? group.suggestions[0]
  return first?.since ?? null
}

/** A short name for the "Answered" ghost, which has no location to look up. */
export function agentHubInboxSenderName(group: AgentHubInboxItemGroup): string {
  const payload = group.asks[0]?.payload
  if (group.asks[0]?.bot) {
    return group.asks[0].bot.name
  }
  switch (payload?.type) {
    case 'bot-item':
      return payload.bot.name
    case 'thread':
      return formatAgentTypeLabel(payload.thread.agentType)
    case 'request':
      return payload.item.request.caller.title ?? payload.item.request.caller.terminalHandle
    default:
      return ''
  }
}
