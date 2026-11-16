import type { AgentJournalRenderItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentSessionLatestTurn } from '../../../../shared/agent-session/agent-session-wire'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  getWorktreeExecutionHostId,
  LOCAL_EXECUTION_HOST_ID
} from '../../../../shared/execution-host'
import { toolInputCommand } from '../../../../shared/native-chat/tools/native-chat-tool-summary'
import { agentSessionCurrentContextRows } from '../../../../shared/agent-session/agent-session-context-clear'
import { readAgentJournalTurnOutcome } from '../../../../shared/agent-session/lifecycle/records/agent-session-turn-record'
import {
  pendingStructuredSessionPrompts,
  type StructuredPromptItem
} from '../../../../shared/agent-session/view/structured-agent-session-message-projection'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubInboxRequest } from './agent-hub-requests-store'

export const AGENT_HUB_ORB_DONE_MS = 6000
export const AGENT_HUB_ORB_TARGET: RuntimeClientTarget = { kind: 'local' }
export type AgentHubOrbAttention =
  | {
      kind: 'request'
      item: AgentHubInboxRequest & {
        request: Extract<AgentHubInboxRequest['request'], { kind: 'ask' }>
      }
    }
  | { kind: 'prompt'; item: StructuredPromptItem }
  | { kind: 'terminal'; thread: AgentPaneThread }
export type AgentHubOrbState =
  | { kind: 'off' | 'idle' | 'listening' | 'error' }
  | { kind: 'working'; command?: string }
  | { kind: 'needsYou'; request: AgentHubOrbAttention }
  | { kind: 'done'; summary: string; reply: string; expiresAt: number }

export function agentHubOrbRequest(item: AgentHubInboxRequest): boolean {
  return item.request.kind === 'ask' && item.request.caller.kind === 'orb'
}

export function agentHubOrbThread(thread: AgentPaneThread, tabId: string | undefined): boolean {
  return (
    tabId !== undefined &&
    thread.tab.id === tabId &&
    !thread.worktree.runtimeOwnerEnvironmentId &&
    getWorktreeExecutionHostId(thread.worktree, thread.repo ?? undefined) ===
      LOCAL_EXECUTION_HOST_ID
  )
}

export function deriveAgentHubOrbState(args: {
  sessionId: string | null
  items: readonly AgentJournalRenderItem[]
  currentRequests?: readonly AgentJournalRenderItem[]
  working: boolean
  listening: boolean
  requests: readonly AgentHubInboxRequest[]
  thread?: AgentPaneThread
  latestTurn?: AgentSessionLatestTurn | null
  now: number
}): AgentHubOrbState {
  if (!args.sessionId) {
    return { kind: 'off' }
  }
  const ask = args.requests.find(
    (item) =>
      item.host === 'local' &&
      item.request.kind === 'ask' &&
      item.request.caller.kind === 'orb' &&
      item.request.caller.sessionId === args.sessionId
  )
  if (ask?.request.kind === 'ask') {
    return {
      kind: 'needsYou',
      request: { kind: 'request', item: { ...ask, request: ask.request } }
    }
  }
  const prompt = pendingStructuredSessionPrompts({
    journalItems: args.items,
    currentRequests: args.currentRequests
  }).at(-1)
  if (prompt) {
    return { kind: 'needsYou', request: { kind: 'prompt', item: prompt } }
  }
  const entry = args.thread?.currentAgentEntry ?? args.thread?.paneEntry
  if (args.thread && entry?.interactivePrompt) {
    return { kind: 'needsYou', request: { kind: 'terminal', thread: args.thread } }
  }
  if (args.listening) {
    return { kind: 'listening' }
  }
  const items = agentSessionCurrentContextRows(args.items).items
  const user = items.findLast(
    (item) => !item.agentId && item.body.kind === 'message' && item.body.role === 'user'
  )
  if (args.working) {
    const tool = items.findLast(
      (item) =>
        !item.agentId &&
        item.body.kind === 'tool-call' &&
        (!user || items.indexOf(item) > items.indexOf(user))
    )
    const command = tool?.body.kind === 'tool-call' ? toolInputCommand(tool.body.input) : null
    return {
      kind: 'working',
      ...(command ? { command: command.replace(/\s+/g, ' ').slice(0, 80) } : {})
    }
  }
  if (readAgentJournalTurnOutcome(args.latestTurn?.turn) === 'failure') {
    return { kind: 'error' }
  }
  const reply = items.findLast(
    (item) => !item.agentId && item.body.kind === 'message' && item.body.role === 'assistant'
  )
  if (reply?.body.kind === 'message' && (!user || items.indexOf(reply) > items.indexOf(user))) {
    const text = reply.body.blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim()
    const summary = text.split(/\r?\n/)[0]?.trim()
    const turn = args.latestTurn?.turn
    if (turn && (turn.state !== 'completed' || readAgentJournalTurnOutcome(turn) !== 'success')) {
      return { kind: 'idle' }
    }
    if (
      args.latestTurn &&
      reply.turnScope?.kind === 'turn' &&
      reply.turnScope.turnItemId !== args.latestTurn.itemId
    ) {
      return { kind: 'idle' }
    }
    const expiresAt =
      (turn?.completedAt ?? reply.body.completedAt ?? reply.observedAt) + AGENT_HUB_ORB_DONE_MS
    if (summary && args.now < expiresAt) {
      return { kind: 'done', summary, reply: text, expiresAt }
    }
  }
  return { kind: 'idle' }
}
