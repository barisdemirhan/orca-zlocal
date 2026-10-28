import { parseRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import type { AgentHubOrbOperation } from '../../../../shared/agent-hub-orb-operation'
import { readAgentHubRequests } from './agent-hub-requests-store'

export type OrbOperationSurface = {
  host?: string
  ptyId?: string
  paneKey?: string
  sessionId?: string
}

export function readOrbOperationForSurface(
  surface: OrbOperationSurface
): AgentHubOrbOperation | undefined {
  const remote = surface.ptyId ? parseRemoteRuntimePtyId(surface.ptyId) : null
  const host = surface.host ?? (remote ? remote.environmentId : 'local')
  if (!host) {
    return undefined
  }
  for (const operation of readAgentHubRequests().get(host)?.orbOperations.values() ?? []) {
    const target = operation.target
    if (!operation.active) {
      continue
    }
    if (target.kind === 'session' && target.sessionId === surface.sessionId) {
      return operation
    }
    if (target.kind === 'pane' && target.paneKey === surface.paneKey) {
      return operation
    }
    if (
      target.kind === 'terminal' &&
      (remote ? target.terminalHandle === remote.handle : target.ptyId === surface.ptyId)
    ) {
      return operation
    }
  }
  return undefined
}

export function isOrbPtyInputProtected(ptyId: string): boolean {
  return Boolean(readOrbOperationForSurface({ ptyId }))
}
