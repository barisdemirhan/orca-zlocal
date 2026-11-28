import type { AgentHubClosed, AgentHubRequest } from '../../../../shared/agent-hub-requests'

export type AgentHubOrbRequestReceipt = AgentHubClosed & { sessionId: string }
export type AgentHubOrbRequestReceipts = ReadonlyMap<string, AgentHubOrbRequestReceipt>
const MAX_SESSIONS = 20

export function projectAgentHubOrbClosedReceipt(
  receipts: AgentHubOrbRequestReceipts,
  request: AgentHubRequest | undefined,
  closed: AgentHubClosed
): AgentHubOrbRequestReceipts {
  const sessionId = request?.caller.sessionId
  if (
    !request ||
    request.caller.kind !== 'orb' ||
    (request.kind === 'notify' && request.level !== 'needs-you') ||
    !sessionId ||
    closed.caller.kind !== 'orb' ||
    closed.requestId !== request.requestId ||
    closed.caller.sessionId !== sessionId ||
    closed.caller.paneKey !== request.caller.paneKey ||
    closed.createdAt !== request.createdAt ||
    closed.target.paneKey !== request.target.paneKey
  ) {
    return receipts
  }
  const next = new Map(receipts)
  next.delete(sessionId)
  next.set(sessionId, { ...closed, sessionId })
  while (next.size > MAX_SESSIONS) {
    const oldest = next.keys().next()
    if (!oldest.done) {
      next.delete(oldest.value)
    }
  }
  return next
}

export function pruneAgentHubOrbReceiptForRequest(
  receipts: AgentHubOrbRequestReceipts,
  request: AgentHubRequest
): AgentHubOrbRequestReceipts {
  const sessionId = request.caller.sessionId
  if (
    request.caller.kind !== 'orb' ||
    (request.kind === 'notify' && request.level !== 'needs-you') ||
    !sessionId ||
    !receipts.has(sessionId)
  ) {
    return receipts
  }
  const next = new Map(receipts)
  next.delete(sessionId)
  return next
}
