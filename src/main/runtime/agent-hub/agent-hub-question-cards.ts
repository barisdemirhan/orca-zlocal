import { delayUnlessAborted } from '../../../shared/concurrency/abort-aware-delay'
import type { PendingPrompt } from '../../../shared/agent-status/contracts/agent-pending-prompt'
import type {
  AgentHubAnswerResult,
  AgentHubQuestion,
  AgentHubQuestionOption
} from '../../../shared/agent-hub-questions'
import type {
  AgentHubGate,
  AgentHubRequest,
  AgentHubResponse
} from '../../../shared/agent-hub-requests'
import type { AgentStatusIpcPayload } from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import { parseAskFromStatus } from '../../../shared/native-chat/input/native-chat-ask'
import { HUB_ANSWER_AGENTS } from './agent-hub-connector-agents'
import { AgentHubError } from './agent-hub-error'
import type { AgentHubPendingRequests } from './agent-hub-pending-requests'

/** Names the CLI in an answer's `desktop`, so the asker can tell it from a window's click. */
export const AGENT_HUB_CLI_DESKTOP = 'orca-cli'
const COLLECT_POLL_MS = 100

type PromptCard = Omit<
  AgentHubQuestion,
  'paneKey' | 'terminal' | 'worktreeId' | 'sshHostId' | 'agent'
>

function askOptions(options: readonly string[]): AgentHubQuestionOption[] {
  return options.map((label, index) => ({ id: String(index + 1), label }))
}

/** The same answer shape Orca's ask card sends for a click. */
function askResponse(
  options: readonly string[],
  multi: boolean,
  indices: number[]
): AgentHubResponse {
  const sorted = [...indices].sort((a, b) => a - b)
  return multi
    ? {
        kind: 'ask',
        answer: sorted.map((index) => options[index - 1]).join(', '),
        index: null,
        indices: sorted
      }
    : { kind: 'ask', answer: options[sorted[0] - 1] ?? '', index: sorted[0] ?? null }
}

export function promptCard(
  prompt: PendingPrompt,
  row: AgentStatusIpcPayload,
  agent: string,
  answerable: boolean
): PromptCard {
  const common = { questionId: prompt.promptId, source: 'agent-prompt' as const }
  if (prompt.kind === 'question') {
    return {
      ...common,
      kind: 'question',
      question: prompt.question,
      ...(prompt.header ? { header: prompt.header } : {}),
      options: prompt.options,
      answerable: true
    }
  }
  if (prompt.kind === 'approval') {
    return {
      ...common,
      kind: 'approval',
      tool: prompt.tool,
      ...(prompt.summary ? { question: prompt.summary } : {}),
      options: prompt.options,
      answerable: false,
      reason: 'approval_requires_ui'
    }
  }
  // Still show what is asked, read-only, so the person can answer it in Orca.
  const ask = parseAskFromStatus(row.interactivePrompt, row.toolName)
  const first = ask?.questions[0]
  const hooksOff = !answerable && HUB_ANSWER_AGENTS.some((candidate) => candidate === agent)
  return {
    ...common,
    kind: 'unsupported',
    ...(first ? { question: first.question } : {}),
    ...(first?.header ? { header: first.header } : {}),
    ...(first?.multiSelect ? { multi: true } : {}),
    ...(row.toolName ? { tool: row.toolName } : {}),
    options: (first?.options ?? []).map((option, index) => ({
      id: String(index + 1),
      label: option.label,
      ...(option.description ? { description: option.description } : {})
    })),
    answerable: false,
    reason: hooksOff ? 'hooks_disabled' : 'prompt_unsupported'
  }
}

export function requestCard(request: AgentHubRequest): AgentHubQuestion | null {
  const base = {
    questionId: request.requestId,
    paneKey: request.caller.paneKey,
    terminal: request.caller.terminalHandle,
    worktreeId: null,
    agent: request.caller.agentType ?? null,
    ...(request.caller.title ? { title: request.caller.title } : {}),
    waitingSince: request.createdAt,
    expiresAt: request.expiresAt
  }
  switch (request.kind) {
    case 'ask':
      return {
        ...base,
        source: 'hub-ask',
        kind: 'ask',
        question: request.question,
        options: askOptions(request.options),
        ...(request.multi ? { multi: true } : {}),
        answerable: true
      }
    case 'consent':
      return {
        ...base,
        source: 'consent',
        kind: 'consent',
        question: `Allow ${request.operation.kind}`,
        options: [],
        answerable: false,
        reason: 'consent_requires_ui'
      }
    case 'memory':
      return {
        ...base,
        source: 'memory',
        kind: 'memory',
        question: request.text,
        options: [],
        answerable: false,
        reason: 'memory_requires_ui'
      }
    default:
      return null
  }
}

export function gateCard(gate: AgentHubGate): AgentHubQuestion {
  return {
    questionId: gate.gateId,
    source: 'gate',
    kind: 'gate',
    question: gate.question,
    options: askOptions(gate.options),
    paneKey: gate.caller.paneKey,
    terminal: gate.caller.terminalHandle,
    worktreeId: null,
    agent: gate.caller.agentType ?? null,
    title: gate.taskTitle,
    waitingSince: gate.createdAt,
    answerable: false,
    reason: 'use_gate_resolve',
    answerVia: `orca orchestration gate-resolve --id ${gate.gateId} --resolution <text>`
  }
}

/** Settles a hub ask for the person, exactly as a click on its card would; the first answer wins. */
export async function settleHubAsk(
  requests: Pick<AgentHubPendingRequests, 'respond' | 'collected'>,
  request: AgentHubRequest,
  optionIds: string[],
  verifyMs: number,
  signal: AbortSignal
): Promise<AgentHubAnswerResult> {
  const questionId = request.requestId
  if (request.kind !== 'ask') {
    return { outcome: 'refused', questionId, reason: 'not_answerable' }
  }
  const indices = optionIds.map(Number)
  if (
    indices.some((index) => !Number.isInteger(index) || index < 1) ||
    indices.some((index) => index > request.options.length) ||
    new Set(indices).size !== indices.length ||
    (!request.multi && indices.length !== 1)
  ) {
    return { outcome: 'refused', questionId, reason: 'option_not_offered' }
  }
  try {
    requests.respond(
      questionId,
      askResponse(request.options, request.multi, indices),
      AGENT_HUB_CLI_DESKTOP
    )
  } catch (error) {
    if (error instanceof AgentHubError && error.code === 'already_resolved') {
      return { outcome: 'refused', questionId, reason: 'question_resolved' }
    }
    if (error instanceof AgentHubError && error.code === 'request_not_found') {
      return { outcome: 'refused', questionId, reason: 'question_not_found' }
    }
    throw error
  }
  // An asker whose connection dropped takes the answer only when it resumes.
  const deadline = Date.now() + verifyMs
  while (requests.collected(questionId) !== true && !signal.aborted && Date.now() < deadline) {
    await delayUnlessAborted(COLLECT_POLL_MS, signal)
  }
  return {
    outcome: 'answered',
    questionId,
    optionIds,
    replayed: false,
    // The asker's pane is busy inside `orca hub ask` throughout, so its status cannot show it resumed.
    evidence: {
      accepted: true,
      delivered: requests.collected(questionId) === true,
      agentContinued: null
    }
  }
}
