import type { ClaudeControlOptions, ClaudeControlQuery } from './claude-agent-sdk-control-requests'

const UI_REQUEST_TIMEOUT_MS = 5000

// request(body, {signal}) sends one control_request and resolves with its control_response body;
// getSettings is built on it. It exists at runtime but is absent from Query's declaration.
type ClaudeQueryRawRequester = {
  request?: (body: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>
}

function claudeQueryRawRequester(
  query: ClaudeControlQuery
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
  query: ClaudeControlQuery,
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

/** What the SDK calls when the engine asks this client to act on its prompt box. */
export type ClaudeUiHost = {
  promptFill: (body: Record<string, unknown>) => Promise<unknown> | unknown
}

// setUiHost(host) exists at runtime but is absent from Query's declaration.
type ClaudeQueryUiHostSetter = { setUiHost?: (host: ClaudeUiHost) => void }

/** Registers `host` on the SDK query; undefined when this SDK has no `setUiHost`. */
export function createClaudeUiHostSetter(
  query: ClaudeControlQuery
): ((host: ClaudeUiHost) => void) | undefined {
  const setUiHost = (query as unknown as ClaudeQueryUiHostSetter).setUiHost
  return typeof setUiHost === 'function' ? (host) => setUiHost.call(query, host) : undefined
}
