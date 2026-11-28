import type { z } from 'zod'
import type { AgentHubCardParams } from '../../../../shared/rpc-contract/agent-hub-params'

type CardParams = z.infer<typeof AgentHubCardParams>

export function agentHubCardOperation(
  params: CardParams
):
  | { action: 'list' }
  | { action: 'show'; drawer: 'work' | 'inbound' | 'changes' | 'pr'; mirrorId?: string }
  | { action: 'events'; since: 'last' | number } {
  if (params.action === 'show') {
    return {
      action: 'show',
      drawer: params.drawer,
      ...(params.mirrorId ? { mirrorId: params.mirrorId } : {})
    }
  }
  return params.action === 'events' ? { action: 'events', since: params.since } : { action: 'list' }
}
