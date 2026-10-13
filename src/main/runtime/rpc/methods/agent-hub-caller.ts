import type { RpcContext } from '../core'
import { AGENT_HUB_REQUESTS_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import type { AgentHubCaller, AgentHubPane } from '../../../../shared/agent-hub-requests'

export function agentHubDesktopId(
  ctx: Pick<RpcContext, 'caller' | 'connectionId' | 'clientKind' | 'clientCapabilities'>
): string | null {
  if (
    ctx.clientKind === 'mobile' ||
    !ctx.clientCapabilities?.includes(AGENT_HUB_REQUESTS_CAPABILITY)
  ) {
    return null
  }
  if (ctx.caller?.kind === 'desktop') {
    return ctx.connectionId ?? 'local-desktop'
  }
  if (ctx.caller?.kind === 'paired-device') {
    return `device:${ctx.caller.deviceId}`
  }
  return null
}

export function resolveAgentHubPanes(
  params: {
    callerTerminalHandle?: string
    callerPaneKey?: string
    callerSessionId?: string
    terminal?: string
  },
  { runtime, caller: rpcCaller }: RpcContext,
  operation?: 'mirror' | 'peek' | 'arrange' | 'canvas'
): { caller: AgentHubCaller; target: AgentHubPane } {
  const handle =
    params.callerTerminalHandle ??
    (params.callerPaneKey ? runtime.getTerminalHandleForPaneKey(params.callerPaneKey) : null)
  let caller = handle ? runtime.getAgentHubCaller(handle) : null
  if (!handle && params.callerSessionId && rpcCaller?.kind === 'local-cli') {
    const current = runtime.agentHubOrb.current()
    if (current?.sessionId === params.callerSessionId) {
      caller = {
        kind: 'orb',
        sessionId: current.sessionId,
        title: 'Orb',
        // Retained for older request readers; these keys never resolve to a terminal pane.
        paneKey: `orb:${current.sessionId}`,
        terminalHandle: `orb:${current.sessionId}`
      }
    }
  }
  if (!caller || (params.callerPaneKey && params.callerPaneKey !== caller.paneKey)) {
    throw new AgentHubError('invalid_argument', 'Caller does not identify a pane on this host')
  }
  if (caller.kind === 'orb' && operation && !params.terminal) {
    throw new AgentHubError(
      'invalid_argument',
      `Orb cannot ${operation} without a target; pass --terminal`
    )
  }
  const target = params.terminal ? runtime.getAgentHubCaller(params.terminal) : caller
  if (!target) {
    throw new AgentHubError('invalid_argument', 'Target terminal was not found on this host')
  }
  return { caller, target: { paneKey: target.paneKey, terminalHandle: target.terminalHandle } }
}
