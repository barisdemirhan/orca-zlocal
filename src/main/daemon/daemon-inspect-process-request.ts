import type { TerminalHost } from './terminal-host/terminal-host'
import type { DaemonRequest } from './protocol/daemon-rpc-contract'

type InspectProcessPayload = Extract<DaemonRequest, { type: 'inspectProcess' }>['payload']

export function inspectProcessForRequest(
  host: TerminalHost,
  payload: InspectProcessPayload
): ReturnType<TerminalHost['inspectProcess']> {
  const options = {
    ...(payload.expectedIncarnationId
      ? { expectedIncarnationId: payload.expectedIncarnationId }
      : {}),
    ...(payload.steadyState === true ? { steadyState: true } : {}),
    ...(payload.ignoreDetached === true ? { ignoreDetached: true } : {})
  }
  return Object.keys(options).length > 0
    ? host.inspectProcess(payload.sessionId, options)
    : host.inspectProcess(payload.sessionId)
}
