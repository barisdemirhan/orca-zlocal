import type { RpcContext } from '../core'
import { AGENT_HUB_REQUESTS_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import type { AgentHubCaller, AgentHubPane } from '../../../../shared/agent-hub-requests'
import { botOfSession } from '../../../bots/bot-session-tabs'

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

/** A chat without a terminal: the current Orb conversation, or one of a bot's chats. */
function chatCaller(runtime: RpcContext['runtime'], sessionId: string): AgentHubCaller | null {
  // Retained for older request readers; these keys never resolve to a terminal pane.
  const keys = (prefix: string) => ({
    paneKey: `${prefix}:${sessionId}`,
    terminalHandle: `${prefix}:${sessionId}`
  })
  if (runtime.agentHubOrb.current()?.sessionId === sessionId) {
    return { kind: 'orb', sessionId, title: 'Orb', ...keys('orb') }
  }
  const bot = botOfSession(runtime.bots, sessionId)
  // Older readers see a pane caller they cannot resolve, titled with the bot's name.
  return bot && runtime.bots.enabled(bot)
    ? { sessionId, botId: bot.id, title: bot.name, agentType: bot.agent, ...keys('bot') }
    : null
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
    caller = chatCaller(runtime, params.callerSessionId)
  }
  if (!caller || (params.callerPaneKey && params.callerPaneKey !== caller.paneKey)) {
    throw new AgentHubError('invalid_argument', 'Caller does not identify a pane on this host')
  }
  if ((caller.kind === 'orb' || caller.botId) && operation && !params.terminal) {
    throw new AgentHubError(
      'invalid_argument',
      `${caller.title ?? 'Orb'} cannot ${operation} without a target; pass --terminal`
    )
  }
  const target = params.terminal ? runtime.getAgentHubCaller(params.terminal) : caller
  if (!target) {
    throw new AgentHubError('invalid_argument', 'Target terminal was not found on this host')
  }
  return { caller, target: { paneKey: target.paneKey, terminalHandle: target.terminalHandle } }
}
