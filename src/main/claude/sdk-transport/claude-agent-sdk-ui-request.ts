import type { Query } from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeControlOptions } from './claude-agent-sdk-control-requests'

const UI_REQUEST_TIMEOUT_MS = 5000

// request(body, {signal}) sends one control_request and resolves with its control_response body;
// getSettings is built on it. It exists at runtime but is absent from Query's declaration.
type ClaudeQueryRawRequester = {
  request?: (body: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>
}

function claudeQueryRawRequester(
  query: Query
): ((body: Record<string, unknown>) => Promise<unknown>) | null {
  const request = (query as unknown as ClaudeQueryRawRequester).request
  return typeof request === 'function' ? (body) => request.call(query, body) : null
}

type RunControl = <T>(
  subtype: string,
  run: () => Promise<T>,
  timeoutMs?: number | null
) => Promise<T>

/** One internal mod-UI control request answering the reply's payload; rejects when this SDK has no raw request. */
export function createClaudeUiRequest(
  query: Query,
  runControl: RunControl
): (body: Record<string, unknown>, options?: ClaudeControlOptions) => Promise<unknown> {
  return (body, options) => {
    const request = claudeQueryRawRequester(query)
    const subtype = typeof body.subtype === 'string' ? body.subtype : 'ui_request'
    return runControl(
      subtype,
      () => {
        if (!request) {
          throw new Error('this SDK exposes no raw control request')
        }
        return request(body)
      },
      options?.timeoutMs ?? UI_REQUEST_TIMEOUT_MS
    ).then((reply) =>
      typeof reply === 'object' && reply !== null && 'response' in reply
        ? reply.response
        : undefined
    )
  }
}
