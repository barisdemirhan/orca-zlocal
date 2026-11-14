import type { RpcContext, RpcRequest } from './core'
import type { AgentHubOrbOperationTarget } from '../../../shared/agent-hub-orb-operation'
import { resolveOrchestrationSessionCaller } from './orchestration/callers/orchestration-session-caller'
import { readOrbOperations } from '../agent-hub/agent-hub-orb-operations'

export async function invokeWithOrbProtection<T>(
  request: RpcRequest,
  params: unknown,
  context: RpcContext,
  invoke: (signal: AbortSignal | undefined) => Promise<T> | T
): Promise<T> {
  if (request.method !== 'terminal.send' && request.method !== 'agentSession.send') {
    return invoke(context.signal)
  }
  const operations = readOrbOperations(context.runtime)
  if (!operations || !params || typeof params !== 'object') {
    return invoke(context.signal)
  }
  const sessionId = request.orchestrationCompatibilityEvidence?.agentSessionId
  const isOrb = Boolean(
    sessionId &&
    context.runtime.isAgentHubEnabled() &&
    context.runtime.agentHubOrb.current()?.sessionId === sessionId
  )
  if (!isOrb && !operations.snapshot().length) {
    return invoke(context.signal)
  }
  let target: AgentHubOrbOperationTarget | undefined
  if (
    request.method === 'terminal.send' &&
    'terminal' in params &&
    typeof params.terminal === 'string'
  ) {
    if ('inputKind' in params && params.inputKind === 'query-reply') {
      return invoke(context.signal)
    }
    if (
      !('text' in params && params.text) &&
      !('enter' in params && params.enter) &&
      !('interrupt' in params && params.interrupt)
    ) {
      return invoke(context.signal)
    }
    const leaf = context.runtime.resolveLiveLeafForHandle(params.terminal)
    const pane = context.runtime.getAgentHubCaller(params.terminal)
    if (leaf?.ptyId) {
      target = {
        kind: 'terminal',
        ptyId: leaf.ptyId,
        terminalHandle: params.terminal,
        ...(pane ? { paneKey: pane.paneKey } : {})
      }
    }
  } else if (
    request.method === 'agentSession.send' &&
    'envelope' in params &&
    params.envelope &&
    typeof params.envelope === 'object' &&
    'sessionId' in params.envelope &&
    typeof params.envelope.sessionId === 'string'
  ) {
    target = { kind: 'session', sessionId: params.envelope.sessionId }
  }
  if (!target) {
    return invoke(context.signal)
  }
  operations.assertWritable(target, isOrb ? sessionId : undefined)
  // Other agents retain their existing caller path. Only the current Orb can start Orb protection.
  if (!sessionId || !isOrb) {
    return invoke(context.signal)
  }
  const resolved = await resolveOrchestrationSessionCaller(
    context.runtime,
    request,
    { pairedDeviceId: context.pairedDeviceId },
    undefined
  )
  const resolvedSessionId = resolved.caller?.kind === 'peer' ? undefined : resolved.caller?.sessionId
  if (resolvedSessionId !== sessionId || context.caller?.kind !== 'local-cli') {
    return invoke(context.signal)
  }
  return operations.run(sessionId, target, request.method, invoke, context.signal)
}
