import { randomUUID } from 'node:crypto'
import type { CommandHandler } from '../dispatch/dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRepeatedStringFlag
} from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import { quoteCliCommandArgument } from '../arguments/shell-command-quote'
import { RuntimeClientError } from '../runtime/types'
import { resolveOrchestrationCliExecutable } from '../orchestration/recovery/orchestration-recovery-command'
import { AgentHubAskParams } from '../../shared/rpc-contract/agent-hub-params'
import type { AgentHubAnswer } from '../../shared/agent-hub-requests'
import {
  agentHubCallerFlags,
  agentHubTimeout,
  callAgentHub,
  parseAgentHubParams
} from './agent-hub-command'

export const agentHubAsk: CommandHandler = async (ctx) => {
  const { flags } = ctx
  const resume = getOptionalStringFlag(flags, 'resume')
  const requestId = resume ? undefined : randomUUID()
  const options = getRepeatedStringFlag(flags, 'option')
  const params = parseAgentHubParams(AgentHubAskParams, {
    ...agentHubCallerFlags(flags),
    question: getOptionalStringFlag(flags, 'question'),
    options: options.length ? options : undefined,
    recommended: getOptionalPositiveIntegerFlag(flags, 'recommended'),
    multi: flags.get('multi') === true,
    timeoutMs: agentHubTimeout(getOptionalStringFlag(flags, 'timeout')),
    ifAway: getOptionalStringFlag(flags, 'if-away'),
    requestId,
    resume
  })
  const rawWait = getOptionalStringFlag(flags, 'wait')
  const waitMs =
    rawWait === undefined ? Math.min(100_000, params.timeoutMs) : agentHubTimeout(rawWait, 'wait')
  if (waitMs > params.timeoutMs) {
    throw new RuntimeClientError('invalid_argument', '--wait cannot exceed --timeout')
  }
  const id = resume ?? requestId ?? ''
  const resumeArgv = [resolveOrchestrationCliExecutable(), 'hub', 'ask', '--resume', id]
  for (const flag of ['environment', 'host']) {
    const value = getOptionalStringFlag(flags, flag)
    if (value) {
      resumeArgv.push(`--${flag}`, value)
    }
  }
  const resumeCommand = resumeArgv.map(quoteCliCommandArgument).join(' ')
  const printPending = (): void => {
    const pending = { status: 'pending', requestId: id, resume: resumeArgv }
    console.log(
      ctx.json
        ? JSON.stringify(pending, null, 2)
        : `Still waiting (${id}). Resume the same question with: ${resumeCommand}`
    )
    process.exitCode = 2
  }
  try {
    const response = await callAgentHub<
      (AgentHubAnswer & { requestId: string }) | { status: 'pending'; requestId: string }
    >(ctx, 'agentHub.ask', { ...params, waitMs }, waitMs + 5_000)
    if ('status' in response.result && response.result.status === 'pending') {
      printPending()
    } else {
      printResult(response, ctx.json, (answer) => ('answer' in answer ? answer.answer : ''))
    }
  } catch (error) {
    if (error instanceof RuntimeClientError && error.code === 'runtime_timeout') {
      // Older hosts ignore waitMs; reconnect with the same ID instead of creating a duplicate.
      printPending()
      return
    }
    if (
      error instanceof RuntimeClientError &&
      [
        'connection_lost',
        'runtime_unavailable',
        'remote_runtime_unavailable',
        'reconnecting'
      ].includes(error.code)
    ) {
      throw new RuntimeClientError(
        error.code,
        `${error.message}. Resume the same question with: ${resumeCommand}`,
        { requestId: id }
      )
    }
    throw error
  }
}
