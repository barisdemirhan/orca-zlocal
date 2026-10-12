import { randomUUID } from 'node:crypto'
import type { CommandHandler } from '../dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRepeatedStringFlag
} from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import {
  AgentHubAskParams,
  AGENT_HUB_MAX_ASK_TIMEOUT_MS
} from '../../shared/rpc-contract/agent-hub-params'
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
  try {
    const response = await callAgentHub<AgentHubAnswer & { requestId: string }>(
      ctx,
      'agentHub.ask',
      params,
      // A resumed question retains its host deadline, which may exceed this invocation's default.
      (resume ? AGENT_HUB_MAX_ASK_TIMEOUT_MS : params.timeoutMs) + 15_000
    )
    printResult(response, ctx.json, (answer) => answer.answer)
  } catch (error) {
    if (
      error instanceof RuntimeClientError &&
      [
        'connection_lost',
        'runtime_unavailable',
        'remote_runtime_unavailable',
        'runtime_timeout',
        'reconnecting'
      ].includes(error.code)
    ) {
      const id = resume ?? requestId
      throw new RuntimeClientError(
        error.code,
        `${error.message}. Resume the same question with: orca hub ask --resume ${id}`,
        { requestId: id }
      )
    }
    throw error
  }
}
