import type { AgentHookEventPayload } from '../../../shared/agent-hook-listener/listener-event'
import type { resolveAgentStatusIdentity } from '../../../shared/agent-status/identity/agent-status-identity'
import type { EnrichedAgentHookEventPayload } from './server-types'

/** Carries root-only Codex context across a relay restart, then stamps the resolved agent identity. */
export function resolveStatusIdentityPayload<T extends AgentHookEventPayload>(
  payload: T,
  previous: EnrichedAgentHookEventPayload | undefined,
  identity: ReturnType<typeof resolveAgentStatusIdentity>
): T {
  const previousCodexRoot =
    payload.payload.agentType === 'codex' &&
    payload.toolAgentId &&
    previous?.payload.agentType === 'codex'
      ? previous
      : undefined
  const preservedProviderSession = !payload.providerSession
    ? previousCodexRoot?.providerSession
    : undefined
  const preservedRootModel = !payload.payload.model ? previousCodexRoot?.payload.model : undefined
  // Relay restart loses root context; child hooks must not erase persisted resume/model identity.
  const rootContextPreservingPayload =
    preservedProviderSession || preservedRootModel
      ? {
          ...payload,
          ...(preservedProviderSession ? { providerSession: preservedProviderSession } : {}),
          payload: preservedRootModel
            ? { ...payload.payload, model: preservedRootModel }
            : payload.payload
        }
      : payload
  return identity.agentType === rootContextPreservingPayload.payload.agentType
    ? rootContextPreservingPayload
    : {
        ...rootContextPreservingPayload,
        payload: {
          ...rootContextPreservingPayload.payload,
          agentType: identity.agentType,
          // A nested agent's model belongs to that agent, not the pane's active owner.
          ...(identity.inheritedFromActivePane
            ? {
                model: previous?.payload.model,
                modelSwitchCommand: previous?.payload.modelSwitchCommand
              }
            : {})
        }
      }
}
