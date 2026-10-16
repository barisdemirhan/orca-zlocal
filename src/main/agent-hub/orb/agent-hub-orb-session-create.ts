import { randomUUID } from 'node:crypto'
import { AGENT_HUB_ORB_ORIGIN } from '../../../shared/agent-hub-orb'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import type { StructuredAgentId } from '../../../shared/agent-session-provider-handle'
import {
  createStructuredAgentSessionId,
  structuredAgentSessionCreateParams
} from '../../../shared/structured-agent-session-create'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-host'
import type { StructuredAgentSessionCaller } from '../../native-chat/agent-session-wire/structured-agent-session-host-types'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { prepareStructuredAgentSessionCreateForWorktree } from '../../runtime/rpc/methods/structured-agent-session-create'

async function resolveAgentHubOrbModel(input: {
  host: StructuredAgentSessionHost
  agent: string
  model: string | null
  explicit: boolean
  workspacePath?: string
}): Promise<string | null> {
  const catalog = input.host.deps.modelCatalog
  if (input.agent !== 'codex') {
    return input.model
  }
  const listed = await catalog?.read({
    agent: input.agent,
    ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
    waitForListing: true
  })
  if (!listed || listed.origin === 'unknown' || listed.models.length === 0 || listed.unavailable) {
    throw new AgentHubError(
      'invalid_argument',
      'Codex models could not be verified. Retry or choose another agent in Orb settings.'
    )
  }
  if (input.model && listed.models.some((model) => model.id === input.model)) {
    return input.model
  }
  if (input.model && input.explicit) {
    throw new AgentHubError(
      'invalid_argument',
      'The selected Codex model is unavailable for this account. Choose a model in Orb settings.'
    )
  }
  return listed.models.find((model) => model.isDefault)?.id ?? listed.models[0].id
}

export async function prepareAgentHubOrbSessionCreate(input: {
  runtime: Pick<OrcaRuntimeService, 'resolveStructuredAgentSessionCreateIntent'>
  host: StructuredAgentSessionHost
  caller: StructuredAgentSessionCaller
  agent: StructuredAgentId
  model: string | null
  cwd?: string
  explicitModel: boolean
  permissionOptions: Record<string, string>
}) {
  const create = structuredAgentSessionCreateParams({
    sessionId: createStructuredAgentSessionId(input.agent, randomUUID),
    worktree: FLOATING_TERMINAL_WORKTREE_ID,
    agent: input.agent,
    randomUuid: randomUUID
  })
  const prepared = await prepareStructuredAgentSessionCreateForWorktree({
    runtime: input.runtime,
    ensureHost: async () => input.host,
    caller: input.caller,
    ...create,
    origin: AGENT_HUB_ORB_ORIGIN,
    ...(input.cwd ? { hostLaunchDirectory: input.cwd } : {}),
    options: { ...(input.model ? { model: input.model } : {}), ...input.permissionOptions }
  })
  const model = await resolveAgentHubOrbModel({
    host: input.host,
    agent: input.agent,
    model: input.model,
    explicit: input.explicitModel,
    workspacePath: prepared.hostLaunchDirectory
  })
  prepared.attachParams.options = { ...(model ? { model } : {}), ...input.permissionOptions }
  return { prepared, model }
}
