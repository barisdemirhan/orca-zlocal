import type { AppState } from '@/store/types'
import type { AgentHubRequest } from '../../../../shared/agent-hub-requests'
import type { AgentHubOrbAwareness } from '../../../../shared/agent-hub-orb-awareness'
import type { RateLimitState } from '../../../../shared/rate-limit-types'
import {
  activityThreadStatusId,
  activityThreadRowCopy
} from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { parseInteractivePrompt } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { agentHubPromptText, agentHubStateSince, type AgentHubLists } from './agent-hub-lists'
import { agentHubInboxRequests, type AgentHubRequestsState } from './agent-hub-requests-store'
import { agentHubRequestHost, findAgentHubRequestTarget } from './agent-hub-request-target'
import { paneTargetFromThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  agentHubOrbQuotaNotices,
  collectAgentHubOrbQuotaAlerts,
  type AgentHubOrbQuotaAlert
} from './agent-hub-orb-quota-notices'
import type { AgentHubOrbNoticeDisplay } from './agent-hub-orb-notice-display'
import { resolveTerminalPtyOwner } from '@/lib/workspace/ownership/terminal-worktree-route'
import { toAgentHibernationRuntimeOwner } from '@/lib/agent-session/hibernation/agent-hibernation-runtime-owner'

export type OrbAwarenessProjection = {
  snapshot: AgentHubOrbAwareness
  targets: ReadonlyMap<string, AgentHubPaneTarget>
  display: ReadonlyMap<string, AgentHubOrbNoticeDisplay>
  quota: readonly AgentHubOrbQuotaAlert[]
}

// Only ask/gate/consent need an answer; a needs-you notify is an update.
function orbNoticeKind(request: AgentHubRequest): AgentHubOrbAwareness['notices'][number]['kind'] {
  if (request.kind !== 'notify') {
    return 'decision'
  }
  return request.level === 'done' ? 'result' : 'info'
}

function requestDisplay(request: AgentHubRequest): AgentHubOrbNoticeDisplay {
  if (request.kind === 'ask' || request.kind === 'gate') {
    return { kind: 'question', question: request.question, options: request.options.length }
  }
  if (request.kind === 'notify') {
    return request.level === 'done'
      ? { kind: 'done', text: request.text }
      : { kind: 'update', text: request.text }
  }
  return { kind: 'approval' }
}

export function collectAgentHubOrbAwareness(input: {
  state: AppState
  threads: readonly AgentPaneThread[]
  lists: AgentHubLists
  requests: AgentHubRequestsState
  remoteLimits: ReadonlyMap<string, RateLimitState | null>
  orbTabId?: string
  now: number
}): OrbAwarenessProjection {
  const { state, lists, requests, now } = input
  const threads = input.threads.filter((thread) => thread.tab.id !== input.orbTabId)
  const targets = new Map<string, AgentHubPaneTarget>()
  const key = (host: string, paneKey: string) => JSON.stringify([host, paneKey])
  const notices = new Map<string, AgentHubOrbAwareness['notices'][number]>()
  const requested = new Set<string>()
  const display = new Map<string, AgentHubOrbNoticeDisplay>()
  const agents = threads
    .map((thread) => {
      const target = paneTargetFromThread(thread, activityThreadRowCopy(thread).taskTitle)
      const host =
        agentHubRequestHost(state, thread.worktree) ?? thread.worktree.hostId ?? 'unverifiable'
      targets.set(key(host, thread.paneKey), target)
      return {
        host,
        paneKey: thread.paneKey,
        title: target.title.slice(0, 320),
        workspace: thread.worktree.path.slice(0, 2_000),
        agent: thread.agentType.slice(0, 100),
        state: activityThreadStatusId(thread),
        since: agentHubStateSince(thread)
      }
    })
    .sort((a, b) => key(a.host, a.paneKey).localeCompare(key(b.host, b.paneKey)))
  for (const { host, request } of agentHubInboxRequests(requests)) {
    if (
      request.caller.kind === 'orb' ||
      request.expiresAt <= now ||
      (request.kind === 'notify' && request.level === 'info')
    ) {
      continue
    }
    const paneKey = request.caller.paneKey
    const targetKey = key(host, paneKey)
    const target =
      targets.get(targetKey) ?? findAgentHubRequestTarget(state, threads, host, request.caller)
    if (target) {
      targets.set(targetKey, target)
    }
    const text =
      request.kind === 'ask' || request.kind === 'gate'
        ? `${request.question}\n${request.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}`
        : request.kind === 'notify'
          ? request.level === 'needs-you'
            ? `Update from the agent, no answer needed: ${request.text}`
            : request.text
          : 'An explicit permission request is waiting in Agent Hub.'
    const id = JSON.stringify(['request', host, request.requestId])
    requested.add(targetKey)
    display.set(id, requestDisplay(request))
    notices.set(id, {
      id,
      host,
      paneKey,
      title: (target?.title ?? request.caller.title ?? request.caller.agentType ?? 'Agent').slice(
        0,
        320
      ),
      kind: orbNoticeKind(request),
      text: text.slice(0, 2_400)
    })
  }
  for (const thread of lists.needsYou) {
    const host = agentHubRequestHost(state, thread.worktree)
    if (!host || thread.tab.id === input.orbTabId || requested.has(key(host, thread.paneKey))) {
      continue
    }
    const prompt = parseInteractivePrompt(
      agentHubPromptText(thread),
      thread.currentAgentEntry?.toolName,
      thread.agentType
    )
    const text =
      prompt?.kind === 'question'
        ? prompt.prompt.questions
            .map(
              (question) =>
                `${question.question}\n${question.options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')}`
            )
            .join('\n\n')
        : prompt?.kind === 'approval'
          ? prompt.approval.title
          : 'A question or blocked step needs attention. Inspect the current agent before acting.'
    const id = JSON.stringify(['status', host, thread.paneKey, agentHubStateSince(thread)])
    const question = prompt?.kind === 'question' ? prompt.prompt.questions[0] : undefined
    display.set(
      id,
      question
        ? { kind: 'question', question: question.question, options: question.options.length }
        : prompt?.kind === 'approval'
          ? { kind: 'approval' }
          : { kind: 'attention' }
    )
    notices.set(id, {
      id,
      host,
      paneKey: thread.paneKey,
      title: activityThreadRowCopy(thread).taskTitle.slice(0, 320),
      kind: 'decision',
      text: text.slice(0, 2_400)
    })
  }
  const usages = threads.flatMap((thread) => {
    const host = agentHubRequestHost(state, thread.worktree)
    if (!host || activityThreadStatusId(thread) === 'unverifiable') {
      return []
    }
    const owner = toAgentHibernationRuntimeOwner(
      resolveTerminalPtyOwner(state, thread.worktree.id),
      []
    )
    const limits =
      owner.kind === 'runtime'
        ? (input.remoteLimits.get(owner.environmentId) ?? null)
        : owner.kind === 'non-runtime' && !thread.worktree.hostId?.startsWith('ssh:')
          ? state.rateLimits
          : null
    return limits ? [{ target: paneTargetFromThread(thread, ''), owner: host, limits }] : []
  })
  const quota = collectAgentHubOrbQuotaAlerts(usages, now)
  for (const alert of quota) {
    for (const notice of agentHubOrbQuotaNotices(alert, now)) {
      notices.set(notice.id, { ...notice, host: alert.owner, paneKey: '', kind: 'quota' })
    }
  }
  return {
    snapshot: {
      observedAt: now,
      totalAgents: agents.length,
      truncated: agents.length > 500 || notices.size > 128,
      agents: agents.slice(0, 500),
      notices: [...notices.values()].slice(0, 128)
    },
    targets,
    display,
    quota
  }
}
