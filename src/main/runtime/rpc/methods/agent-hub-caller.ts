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
  params: { callerTerminalHandle?: string; callerPaneKey?: string; terminal?: string },
  { runtime }: RpcContext
): { caller: AgentHubCaller; target: AgentHubPane } {
  const handle =
    params.callerTerminalHandle ??
    (params.callerPaneKey ? runtime.getTerminalHandleForPaneKey(params.callerPaneKey) : null)
  const caller = handle ? runtime.getAgentHubCaller(handle) : null
  if (!caller || (params.callerPaneKey && params.callerPaneKey !== caller.paneKey)) {
    throw new AgentHubError('invalid_argument', 'Caller does not identify a pane on this host')
  }
  const target = params.terminal ? runtime.getAgentHubCaller(params.terminal) : caller
  if (!target) {
    throw new AgentHubError('invalid_argument', 'Target terminal was not found on this host')
  }
  return { caller, target: { paneKey: target.paneKey, terminalHandle: target.terminalHandle } }
}
