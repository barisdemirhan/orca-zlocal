import type { CommandHandler, HandlerContext } from '../dispatch/dispatch'
import { getOptionalStringFlag, getRepeatedStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import { RuntimeClient } from '../runtime/client'
import { RuntimeClientError } from '../runtime/connection/types'
import type {
  AgentHubAnswerResult,
  AgentHubQuestion,
  AgentHubQuestionsResult
} from '../../shared/agent-hub-questions'
import { hostScopeCensusIsComplete } from '../../shared/execution-host/runtime-listing-host-scope'
import type { RuntimeListingHostScope } from '../../shared/execution-host/runtime-listing-host-scope'
import type { RuntimeWorktreePsResult } from '../../shared/worktree/catalog/runtime-worktree-contracts'
import { AGENT_HUB_ANSWER_MAX_VERIFY_MS } from '../../shared/rpc-contract/agent-hub-params'

const LIST_TIMEOUT_MS = 15_000
const QUESTIONS_VERSION = 1

/** `connect` runs inside the host's own try: a broken saved environment fails only its row. */
type HostTarget = { connect: () => RuntimeClient; host: string; environment: string | null }

export type AgentHubHostQuestions = {
  host: string
  /** The `--environment` selector that reaches this host; null for this machine. */
  environment: string | null
  status: 'ok' | 'unsupported' | 'unreachable'
  runtimeId?: string
  error?: { code: string; message: string }
  /** Whether this host saw every machine it serves; false is a gap, not "no questions". */
  complete: boolean
  hostScope?: RuntimeListingHostScope
  questions: (AgentHubQuestion & { answerArgv?: string[] })[]
}

export type AgentHubQuestionsListing = {
  hosts: AgentHubHostQuestions[]
  /** True only when every listed host answered fully; paired hosts not listed here are never covered. */
  complete: boolean
}

function isMissingMethod(error: unknown): boolean {
  return (
    error instanceof RuntimeClientError &&
    (error.code === 'method_not_found' || error.code === 'unknown_method')
  )
}

function answerArgv(environment: string | null, question: AgentHubQuestion): string[] {
  return [
    'orca',
    'hub',
    'answer',
    ...(environment ? ['--environment', environment] : []),
    '--question',
    question.questionId,
    '--option',
    '<id>'
  ]
}

async function targets(ctx: HandlerContext): Promise<HostTarget[]> {
  if (ctx.flags.get('all-hosts') !== true) {
    const environment = ctx.client.environmentSelector
    return [{ connect: () => ctx.client, host: environment ?? 'local', environment }]
  }
  const { listEnvironments } =
    await import('../../shared/remote-runtime/host-store/runtime-environment-store.js')
  const userDataPath = ctx.client.userDataPath
  return [
    {
      connect: () => new RuntimeClient(userDataPath, undefined, null, null),
      host: 'local',
      environment: null
    },
    ...(await listEnvironments(userDataPath)).map((environment) => ({
      connect: () => new RuntimeClient(userDataPath, undefined, null, environment.id),
      host: environment.name,
      environment: environment.name
    }))
  ]
}

/** An older host cannot read prompts; still show which of its agents wait, so silence is never "none". */
async function listWaitingFromOldHost(
  target: HostTarget,
  client: RuntimeClient
): Promise<AgentHubHostQuestions> {
  const unsupported = {
    code: 'unsupported_host',
    message: 'This Orca version cannot list or answer questions; update it or answer in Orca'
  }
  try {
    const ps = await client.call<RuntimeWorktreePsResult>('worktree.ps', undefined, {
      timeoutMs: LIST_TIMEOUT_MS
    })
    const questions = ps.result.worktrees.flatMap((worktree) =>
      worktree.agents
        .filter((agent) => agent.state === 'waiting' || agent.state === 'blocked')
        .map((agent): AgentHubQuestion => ({
          questionId: `pane:${agent.paneKey}`,
          source: 'agent-prompt',
          kind: 'unsupported',
          options: [],
          paneKey: agent.paneKey,
          terminal: null,
          worktreeId: worktree.worktreeId,
          agent: agent.agentType,
          ...(agent.toolName ? { tool: agent.toolName } : {}),
          ...(worktree.displayName ? { title: worktree.displayName } : {}),
          waitingSince: agent.stateStartedAt,
          answerable: false,
          reason: 'host_unsupported'
        }))
    )
    return {
      host: target.host,
      environment: target.environment,
      status: 'unsupported',
      runtimeId: ps._meta.runtimeId,
      error: unsupported,
      complete: false,
      questions
    }
  } catch {
    return {
      host: target.host,
      environment: target.environment,
      status: 'unsupported',
      error: unsupported,
      complete: false,
      questions: []
    }
  }
}

async function listHost(target: HostTarget): Promise<AgentHubHostQuestions> {
  let client: RuntimeClient | null = null
  let response
  try {
    client = target.connect()
    response = await client.call<AgentHubQuestionsResult>(
      'agentHub.questions',
      {},
      {
        timeoutMs: LIST_TIMEOUT_MS
      }
    )
  } catch (error) {
    if (client && isMissingMethod(error)) {
      return listWaitingFromOldHost(target, client)
    }
    return {
      host: target.host,
      environment: target.environment,
      status: 'unreachable',
      error: {
        code: error instanceof RuntimeClientError ? error.code : 'error',
        message: error instanceof Error ? error.message : String(error)
      },
      complete: false,
      questions: []
    }
  }
  const { result } = response
  if (result.questionsVersion !== QUESTIONS_VERSION) {
    return {
      host: target.host,
      environment: target.environment,
      status: 'unsupported',
      runtimeId: response._meta.runtimeId,
      error: {
        code: 'unsupported_version',
        message: `Questions version ${String(result.questionsVersion)} is not supported by this CLI`
      },
      complete: false,
      questions: []
    }
  }
  return {
    host: target.host,
    environment: target.environment,
    status: 'ok',
    runtimeId: response._meta.runtimeId,
    complete: hostScopeCensusIsComplete(result.hostScope),
    ...(result.hostScope ? { hostScope: result.hostScope } : {}),
    questions: result.questions.map((question) =>
      question.answerable
        ? { ...question, answerArgv: answerArgv(target.environment, question) }
        : question
    )
  }
}

function formatQuestion(question: AgentHubHostQuestions['questions'][number]): string[] {
  const who = [question.agent, question.title, question.terminal].filter(Boolean).join(' · ')
  const state = question.answerable ? 'answerable' : `read-only: ${question.reason ?? 'unknown'}`
  const lines = [
    `  ${question.questionId}  [${question.source}/${question.kind}] ${who} (${state})`
  ]
  if (question.question) {
    lines.push(`    ${question.header ? `${question.header}: ` : ''}${question.question}`)
  }
  if (question.tool && !question.question) {
    lines.push(`    waiting on ${question.tool}`)
  }
  for (const option of question.options) {
    lines.push(
      `    ${option.id}) ${option.label}${option.description ? ` — ${option.description}` : ''}`
    )
  }
  if (question.answerArgv) {
    lines.push(`    answer: ${question.answerArgv.join(' ')}`)
  }
  if (question.answerVia) {
    lines.push(`    answer: ${question.answerVia}`)
  }
  return lines
}

export function formatAgentHubQuestions(listing: AgentHubQuestionsListing): string {
  const lines: string[] = []
  for (const host of listing.hosts) {
    const coverage = host.complete ? 'complete' : 'partial'
    lines.push(
      host.status === 'ok'
        ? `${host.host}: ${host.questions.length} waiting (${coverage})`
        : `${host.host}: ${host.status} — ${host.error?.message ?? ''}`.trimEnd()
    )
    lines.push(...host.questions.flatMap(formatQuestion))
  }
  lines.push(
    listing.complete
      ? 'Every listed host answered in full. Paired hosts not listed were not asked.'
      : 'Coverage is partial: a host that is unsupported, unreachable or partial may still have waiting questions.'
  )
  return lines.join('\n')
}

function parseVerifyMs(raw: string | undefined): number {
  if (raw === undefined) {
    return 3_000
  }
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(raw)
  const ms = match ? Number(match[1]) * (match[2] === 's' ? 1_000 : 1) : Number.NaN
  if (!Number.isInteger(ms) || ms < 0 || ms > AGENT_HUB_ANSWER_MAX_VERIFY_MS) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--verify takes a duration such as 0s, 3s or 500ms, at most ${AGENT_HUB_ANSWER_MAX_VERIFY_MS / 1_000}s`
    )
  }
  return ms
}

function formatAnswer(result: AgentHubAnswerResult): string {
  if (result.outcome === 'answered') {
    const { delivered, agentContinued } = result.evidence
    const seen = (value: boolean | null): string => (value === null ? 'not checked' : String(value))
    return [
      `${result.replayed ? 'Already answered' : 'Answered'} ${result.questionId} with option ${result.optionIds.join(', ')}`,
      `  accepted: true · delivered: ${seen(delivered)} · agent continued: ${seen(agentContinued)}`
    ].join('\n')
  }
  if (result.outcome === 'refused') {
    const earlier = result.answeredOptionIds
      ? ` (answered earlier with ${result.answeredOptionIds.join(', ')})`
      : ''
    return `Not answered: ${result.reason}${earlier}`
  }
  return 'Unknown: the answer may have reached the agent. List the questions again before retrying.'
}

export const AGENT_HUB_QUESTION_HANDLERS: Record<string, CommandHandler> = {
  'hub questions': async (ctx) => {
    const hosts = await Promise.all((await targets(ctx)).map(listHost))
    const listing: AgentHubQuestionsListing = {
      hosts,
      complete: hosts.every((host) => host.status === 'ok' && host.complete)
    }
    // Several hosts answer, so there is no single runtime response envelope to print.
    console.log(
      ctx.json
        ? JSON.stringify({ ok: true, result: listing }, null, 2)
        : formatAgentHubQuestions(listing)
    )
  },
  'hub answer': async (ctx) => {
    const questionId = getOptionalStringFlag(ctx.flags, 'question')
    const optionIds = getRepeatedStringFlag(ctx.flags, 'option')
    if (!questionId || optionIds.length === 0) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Usage: orca hub answer --question <id> --option <id> (see orca hub questions)'
      )
    }
    const verifyMs = parseVerifyMs(getOptionalStringFlag(ctx.flags, 'verify'))
    let response
    try {
      response = await ctx.client.call<AgentHubAnswerResult>(
        'agentHub.answer',
        { questionId, optionIds, verifyMs },
        { timeoutMs: verifyMs + 30_000 }
      )
    } catch (error) {
      if (isMissingMethod(error)) {
        throw new RuntimeClientError(
          'unsupported_host',
          'This Orca version cannot answer questions from the CLI; update it or answer in Orca'
        )
      }
      throw error
    }
    printResult(response, ctx.json, formatAnswer)
    if (response.result.outcome !== 'answered') {
      process.exitCode = 1
    }
  }
}
