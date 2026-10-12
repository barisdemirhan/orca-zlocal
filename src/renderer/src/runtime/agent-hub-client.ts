import type { AgentHubRendererApi } from '../../../shared/agent-hub-requests'
import {
  AgentHubRespondParams,
  AgentHubRespondResultSchema
} from '../../../shared/rpc-contract/agent-hub-params'
import { readAgentHubDelivery } from '../../../shared/rpc-contract/agent-hub-events'
import { subscribeRuntimeEnvironment } from './runtime-environment-pairing-refresh'
import { getRuntimeEnvironmentRevision } from './runtime-environment-revision'

/** Phase 2 mounts this client only while the local Agent Hub experiment is enabled. */
export function createAgentHubClient(
  environmentId: string | null = null,
  onError: (error: unknown) => void = console.warn
): AgentHubRendererApi {
  return {
    subscribe(handler) {
      let stopped = false
      let unsubscribe: (() => void) | undefined
      const receive = (response: { ok: boolean; result?: unknown; error?: unknown }): void => {
        if (stopped) {
          return
        }
        if (!response.ok) {
          onError(response.error)
          return
        }
        try {
          const event = readAgentHubDelivery(response.result)
          if (event) {
            handler(event)
          }
        } catch (error) {
          onError(error)
        }
      }
      const args = { method: 'runtime.clientEvents.subscribe', params: { agentHub: true } }
      const pending =
        environmentId === null
          ? window.api.runtime.subscribe(args, receive)
          : subscribeRuntimeEnvironment(
              {
                ...args,
                selector: environmentId,
                timeoutMs: 15_000,
                expectedEnvironmentPairingRevision: getRuntimeEnvironmentRevision(environmentId)
              },
              { onResponse: receive, onError }
            )
      void pending
        .then((subscription) => {
          if (stopped) {
            subscription.unsubscribe()
          } else {
            unsubscribe = subscription.unsubscribe
          }
        })
        .catch(onError)
      return () => {
        stopped = true
        unsubscribe?.()
      }
    },
    async respond(requestId, result) {
      const params = AgentHubRespondParams.parse({ requestId, result })
      const args = { method: 'agentHub.respond', params }
      const response =
        environmentId === null
          ? await window.api.runtime.call(args)
          : await window.api.runtimeEnvironments.call({
              ...args,
              selector: environmentId,
              expectedEnvironmentPairingRevision: getRuntimeEnvironmentRevision(environmentId)
            })
      if (!response.ok) {
        throw response.error
      }
      return AgentHubRespondResultSchema.parse(response.result)
    }
  }
}
