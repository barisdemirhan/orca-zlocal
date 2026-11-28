import { ZodError } from 'zod'
import type { HandlerContext } from '../dispatch/dispatch'
import { getOptionalStringFlag } from '../arguments/flags'
import { RuntimeClientError } from '../runtime/connection/types'
import { printResult } from '../output/command-result-output'
import { formatAgentHubResult } from './agent-hub-output'
import { getCallerAgentSessionId, getCallerTerminalHandle } from '../caller-terminal-handle'
import {
  AGENT_HUB_DEFAULT_ASK_TIMEOUT_MS,
  AGENT_HUB_MAX_ASK_TIMEOUT_MS
} from '../../shared/rpc-contract/agent-hub-params'

export function agentHubCallerFlags(flags: Map<string, string | boolean>): {
  callerTerminalHandle?: string
  callerPaneKey?: string
  callerSessionId?: string
  terminal?: string
} {
  const callerTerminalHandle = getCallerTerminalHandle()?.trim() || undefined
  const callerSessionId = callerTerminalHandle ? undefined : getCallerAgentSessionId()
  const callerPaneKey = callerTerminalHandle
    ? undefined
    : callerSessionId
      ? undefined
      : process.env.ORCA_PANE_KEY?.trim() || undefined
  if (!callerTerminalHandle && !callerPaneKey && !callerSessionId) {
    throw new RuntimeClientError('invalid_argument', 'Run hub commands inside an Orca terminal')
  }
  return {
    callerTerminalHandle,
    callerPaneKey,
    callerSessionId,
    terminal: getOptionalStringFlag(flags, 'terminal')
  }
}

export function parseAgentHubParams<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new RuntimeClientError(
        'invalid_argument',
        error.issues[0]?.message ?? 'Invalid hub arguments'
      )
    }
    throw error
  }
}

export function agentHubTimeout(raw?: string, flag = 'timeout'): number {
  if (raw === undefined) {
    return AGENT_HUB_DEFAULT_ASK_TIMEOUT_MS
  }
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(raw)
  if (!match) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Use a duration such as 30m, 10s, 500ms, or 1h for --${flag}`
    )
  }
  const units: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }
  const timeoutMs = Number(match[1]) * units[match[2]]
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > AGENT_HUB_MAX_ASK_TIMEOUT_MS) {
    throw new RuntimeClientError('invalid_argument', `--${flag} must be between 1ms and 24h`)
  }
  return timeoutMs
}

export async function callAgentHub<T>(
  ctx: HandlerContext,
  method: string,
  params: unknown,
  timeoutMs = 35_000
) {
  try {
    return await ctx.client.call<T>(method, params, { timeoutMs })
  } catch (error) {
    if (error instanceof RuntimeClientError) {
      if (error.code === 'method_not_found' || error.code === 'unknown_method') {
        throw new RuntimeClientError(
          'unsupported_host',
          'This Orca version does not support hub commands'
        )
      }
      if (
        error.code === 'rate_limited' &&
        typeof error.data === 'object' &&
        error.data !== null &&
        'retryAfterMs' in error.data &&
        typeof error.data.retryAfterMs === 'number'
      ) {
        throw new RuntimeClientError(
          error.code,
          `${error.message} (retry after ${error.data.retryAfterMs}ms)`,
          error.data
        )
      }
    }
    throw error
  }
}

export async function printAgentHubCommand(
  ctx: HandlerContext,
  method: string,
  params: unknown
): Promise<void> {
  const response = await callAgentHub<unknown>(ctx, method, params)
  printResult(response, ctx.json, (result) => formatAgentHubResult(method, result))
}
