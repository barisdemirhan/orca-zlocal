import { defineMethod } from '../core'
import { AgentHubOrbRememberParams } from '../../../../shared/rpc-contract/agent-hub-params'
import type { AgentHubResponse } from '../../../../shared/agent-hub-requests'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import { normalizeAgentHubOrbMemory } from '../../agent-hub/agent-hub-orb-memory-proposals'
import {
  appendAgentHubOrbMemory,
  readAgentHubOrbMemory
} from '../../../agent-hub/orb/agent-hub-orb-identity-files'
import type { OrcaRuntimeService } from '../../orca-runtime'
import {
  agentHubOrbIdentityDirectory,
  findAgentHubOrbBot
} from '../../../agent-hub/orb/agent-hub-orb-bot'
import { resolveAgentHubPanes } from './agent-hub-caller'

const writing = new Set<string>()

export const AGENT_HUB_ORB_MEMORY_METHODS = [
  defineMethod({
    name: 'agentHub.orb.remember',
    permission: 'workspace',
    params: AgentHubOrbRememberParams,
    handler: async (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx)
      if (caller.kind !== 'orb') {
        throw new AgentHubError(
          'invalid_argument',
          'Only the Orb proposes memories, from its Home Chat in the Orb window'
        )
      }
      if (!ctx.runtime.isAgentHubOrbMemorySuggestionsEnabled()) {
        throw new AgentHubError(
          'disabled_by_user',
          'The user turned memory suggestions off; do not propose memories'
        )
      }
      const key = normalizeAgentHubOrbMemory(params.text)
      const saved = await readAgentHubOrbMemory(
        agentHubOrbIdentityDirectory(ctx.runtime.bots.list())
      )
      if (saved.some((entry) => normalizeAgentHubOrbMemory(entry.text) === key)) {
        throw new AgentHubError('invalid_argument', 'This is already in memory.')
      }
      ctx.runtime.agentHub.proposeMemory(caller, target, params.text)
      return { proposed: true, message: 'Proposed; the user decides in the Orb window.' }
    }
  })
] as const

/** The file is written before the request settles, so a failed write leaves the card retryable. */
export async function respondToAgentHubMemory(
  runtime: OrcaRuntimeService,
  requestId: string,
  result: Extract<AgentHubResponse, { kind: 'memory' }>,
  desktop: string
): Promise<{ accepted: true; requestId: string }> {
  if (
    result.decision === 'remember' &&
    runtime.agentHub.pendingMemoryText(requestId) !== undefined
  ) {
    if (!result.text) {
      throw new AgentHubError('invalid_argument', 'Memory text cannot be empty')
    }
    if (writing.has(requestId)) {
      throw new AgentHubError('already_resolved', 'This memory is already being saved')
    }
    writing.add(requestId)
    try {
      const bots = runtime.bots.list()
      await appendAgentHubOrbMemory(
        result.text,
        new Date(),
        agentHubOrbIdentityDirectory(bots),
        findAgentHubOrbBot(bots) ? 'bot' : 'orb'
      )
      return runtime.agentHub.respond(requestId, result, desktop)
    } finally {
      writing.delete(requestId)
    }
  }
  return runtime.agentHub.respond(requestId, result, desktop)
}
