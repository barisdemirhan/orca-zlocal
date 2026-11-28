import type { OrcaRuntimeService } from '../../../../orca-runtime'
import type { AgentSessionAttachParams } from '../../../../../native-chat/agent-session-wire/acquisition/structured-agent-session-attach'
import type { StructuredAgentSessionHost } from '../../../../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { StructuredAgentSessionCreateOptions } from '../../../../../native-chat/agent-session-wire/acquisition/structured-agent-session-create'
import type { StructuredAgentId } from '../../../../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle'

/** The runtime slices a structured session create reads, so the Orb can create one too. */
export type StructuredAgentSessionPrepareRuntime = Pick<
  OrcaRuntimeService,
  | 'resolveStructuredAgentSessionCreateIntent'
  | 'getAgentProviderSessionRows'
  | 'resolveStructuredAgentSessionLocalWorkspacePath'
  | 'getStructuredAgentCliSourceRoute'
>

export type StructuredAgentSessionCommitRuntime = Pick<
  OrcaRuntimeService,
  'publishStructuredAgentSessionTab'
>

export type PreparedStructuredAgentSessionCreate = {
  host: StructuredAgentSessionHost
  attachParams: AgentSessionAttachParams
  hostLaunchDirectory?: string
  catalogModels?: StructuredAgentSessionCreateOptions['catalogModels']
  /** Null when the caller supplied its own location; only a resolved worktree publishes a tab. */
  tab: { workspaceId: string; agent: StructuredAgentId } | null
  /** Absent for older clients and provider-dependent in-process callers. */
  atRest?: StructuredAgentSessionCreateOptions
}
