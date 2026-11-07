import { randomUUID } from 'node:crypto'
import {
  AGENT_HUB_ORB_ORIGIN,
  AGENT_HUB_ORB_OPENING_PROMPT,
  type AgentHubOrbSession
} from '../../../shared/agent-hub-orb'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import type { StructuredAgentId } from '../../../shared/agent-session/lifecycle/agent-session-provider-handle'
import {
  createStructuredAgentSessionId,
  structuredAgentSessionCreateParams
} from '../../../shared/agent-session/structured-agent-session-create'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { StructuredAgentSessionCaller } from '../../native-chat/agent-session-wire/host/structured-agent-session-host-types'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import {
  commitStructuredAgentSessionCreate,
  prepareStructuredAgentSessionCreateForWorktree,
  type PreparedStructuredAgentSessionCreate
} from '../../runtime/rpc/methods/structured-sessions/creation/structured-agent-session-create'
import { sendAgentHubOrbOpeningPrompt } from './agent-hub-orb-opening-prompt-send'
import { isAgentHubOrbDirectory } from './agent-hub-orb-directory'

async function resolveAgentHubOrbModel(input: {
  host: StructuredAgentSessionHost
  agent: string
  model: string | null
  workspacePath?: string
}): Promise<string | null> {
  const catalog = input.host.deps.modelCatalog
  if (input.agent !== 'codex' || !input.model) {
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
  throw new AgentHubError(
    'invalid_argument',
    'The selected Codex model is unavailable for this account. Choose a model in Orb settings.'
  )
}

export async function prepareAgentHubOrbSessionCreate(input: {
  runtime: Pick<
    OrcaRuntimeService,
    | 'resolveStructuredAgentSessionCreateIntent'
    | 'getAgentProviderSessionRows'
    | 'resolveStructuredAgentSessionLocalWorkspacePath'
    | 'getStructuredAgentCliSourceRoute'
  >
  host: StructuredAgentSessionHost
  caller: StructuredAgentSessionCaller
  agent: StructuredAgentId
  model: string | null
  cwd: string
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
    hostLaunchDirectory: input.cwd,
    options: { ...(input.model ? { model: input.model } : {}), ...input.permissionOptions }
  })
  const model = await resolveAgentHubOrbModel({
    host: input.host,
    agent: input.agent,
    model: input.model,
    workspacePath: prepared.hostLaunchDirectory
  })
  prepared.attachParams.options = { ...(model ? { model } : {}), ...input.permissionOptions }
  return { prepared, model }
}

export async function commitAgentHubOrbSessionCreate(input: {
  runtime: Pick<OrcaRuntimeService, 'publishStructuredAgentSessionTab'>
  caller: StructuredAgentSessionCaller
  prepared: PreparedStructuredAgentSessionCreate
}): Promise<AgentHubOrbSession> {
  const result = await commitStructuredAgentSessionCreate({ ...input, activate: false })
  if (result.ok) {
    return {
      sessionId: result.value.sessionId,
      ...(result.value.tabId ? { tabId: result.value.tabId } : {}),
      resumed: false
    }
  }
  const { host, attachParams, tab } = input.prepared
  const record = host.deps.store.getRecord(attachParams.envelope.sessionId)
  if (
    result.refusal.code === 'agent_session_operation_unknown' &&
    record?.origin === AGENT_HUB_ORB_ORIGIN &&
    tab
  ) {
    await input.runtime.publishStructuredAgentSessionTab({
      workspaceId: tab.workspaceId,
      sessionId: record.sessionId,
      agent: tab.agent,
      activate: false
    })
    const tabId = host.getSessionTabId(record.sessionId)
    if (tabId) {
      return { sessionId: record.sessionId, tabId, resumed: false }
    }
  }
  throw new AgentHubError('invalid_argument', result.refusal.message)
}

/** A chat in the Orb folder reads its instruction files; one launched elsewhere (an explicit
 *  client cwd) still gets them as its first message. */
export async function ensureAgentHubOrbOpeningPrompt(
  host: StructuredAgentSessionHost,
  caller: StructuredAgentSessionCaller,
  sessionId: string,
  orbDirectory: string
): Promise<void> {
  const record = host.deps.store.getRecord(sessionId)
  if (!record) {
    throw new AgentHubError('not_found', 'Orb conversation was not found on this host')
  }
  if (isAgentHubOrbDirectory(record.launchDirectory, orbDirectory)) {
    return
  }
  const snapshot = await host.journalSnapshot(sessionId)
  if (snapshot.items.length > 0 || snapshot.submissions.length > 0) {
    return
  }
  const committed = await sendAgentHubOrbOpeningPrompt({
    host,
    caller,
    sessionId,
    fence: record.lease.runtimeFence,
    text: AGENT_HUB_ORB_OPENING_PROMPT
  })
  if (!committed) {
    throw new AgentHubError(
      'invalid_argument',
      'Orb was created but its opening prompt was not committed'
    )
  }
}
