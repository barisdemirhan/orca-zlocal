import type { AgentHubRendererApi } from '../../../shared/agent-hub-requests'
import {
  AgentHubRespondParams,
  AgentHubRespondResultSchema
} from '../../../shared/rpc-contract/agent-hub-params'
import { readAgentHubDelivery } from '../../../shared/rpc-contract/agent-hub-events'
import { subscribeRuntimeEnvironment } from './runtime-environment-pairing-refresh'
import { getRuntimeEnvironmentRevision } from './runtime-environment-revision'
import {
  isAgentHubUnsupportedError,
  retainAgentHubConsumerCapability
} from './agent-hub-consumer-capability'

/** The mounted consumer owns capability admission, subscription and response host identity. */
export function createAgentHubClient(
  environmentId: string | null = null,
  onError: (error: unknown) => void = console.warn
): AgentHubRendererApi {
  const pairingRevision =
    environmentId === null ? undefined : getRuntimeEnvironmentRevision(environmentId)
  return {
    subscribe(handler) {
      let stopped = false
      let unsubscribe: (() => void) | undefined
      const reportError = (error: unknown): void => {
        if (!stopped && !isAgentHubUnsupportedError(error)) {
          onError(error)
        }
      }
      const lease =
        environmentId === null
          ? null
          : retainAgentHubConsumerCapability(environmentId, pairingRevision)
      const receive = (response: { ok: boolean; result?: unknown; error?: unknown }): void => {
        if (stopped) {
          return
        }
        if (!response.ok) {
          reportError(response.error)
          return
        }
        try {
          const event = readAgentHubDelivery(response.result)
          if (event) {
            handler(event)
          }
        } catch (error) {
          reportError(error)
        }
      }
      const args = { method: 'runtime.clientEvents.subscribe', params: { agentHub: true } }
      const pending =
        environmentId === null
          ? window.api.runtime.subscribe(args, receive)
          : lease?.ready.then(() => {
              if (stopped) {
                return { unsubscribe: () => {} }
              }
              return subscribeRuntimeEnvironment(
                {
                  ...args,
                  selector: environmentId,
                  timeoutMs: 15_000,
                  expectedEnvironmentPairingRevision: pairingRevision
                },
                { onResponse: receive, onError: reportError }
              )
            })
      void pending
        ?.then((subscription) => {
          if (stopped) {
            subscription.unsubscribe()
          } else {
            unsubscribe = subscription.unsubscribe
          }
        })
        .catch(reportError)
      return () => {
        stopped = true
        unsubscribe?.()
        void lease?.release().catch((error: unknown) => {
          if (!isAgentHubUnsupportedError(error)) {
            onError(error)
          }
        })
      }
    },
    async respond(requestId, result) {
      // Why: v1 hosts only accept the original two renderer error codes.
      const compatibleResult =
        environmentId !== null && result.kind === 'error' && result.code === 'invalid_argument'
          ? { ...result, code: 'disabled_by_user' as const }
          : result
      const params = AgentHubRespondParams.parse({ requestId, result: compatibleResult })
      const args = { method: 'agentHub.respond', params }
      const response =
        environmentId === null
          ? await window.api.runtime.call(args)
          : await window.api.runtimeEnvironments.call({
              ...args,
              selector: environmentId,
              expectedEnvironmentPairingRevision: pairingRevision
            })
      if (!response.ok) {
        throw response.error
      }
      return AgentHubRespondResultSchema.parse(response.result)
    }
  }
}
