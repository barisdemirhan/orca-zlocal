import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { isWebClientLocation } from '@/app-shell/platform/web-client-location'
import {
  isDisconnectedRuntimeHostState,
  runtimeHostConnectionStateForEntry
} from '@/runtime/hosts/connections/runtime-host-connection-state'
import { createAgentHubClient } from '@/runtime/agent-hub-client'
import { AGENT_HUB_REQUESTS_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import { lastVerifiedRuntimeStatus } from '../../../../shared/remote-runtime/host-status/runtime-host-status'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubLists } from './agent-hub-lists'
import { AgentHubRequestConsumer, type AgentHubConsumerHost } from './agent-hub-request-consumer'
import {
  applyAgentHubDelivery,
  clearAgentHubRequestHost,
  readAgentHubRequests
} from './agent-hub-requests-store'
import { executeAgentHubRequest } from './agent-hub-request-executor'
import { registerAgentHubRequestResponder } from './agent-hub-request-answer'

export function agentHubConsumerHosts(state: AppState): AgentHubConsumerHost[] {
  const hosts: AgentHubConsumerHost[] = [{ host: 'local', revision: 'local' }]
  for (const environment of state.runtimeEnvironments) {
    const status = state.runtimeStatusByEnvironmentId.get(environment.id)
    const verified = lastVerifiedRuntimeStatus(status)
    if (
      !verified?.capabilities?.includes(AGENT_HUB_REQUESTS_CAPABILITY) ||
      isDisconnectedRuntimeHostState(runtimeHostConnectionStateForEntry(status))
    ) {
      continue
    }
    hosts.push({
      host: environment.id,
      revision: JSON.stringify([
        environment.pairingRevision ?? environment.createdAt,
        verified.runtimeId,
        status?.connectionGeneration ?? 0,
        status?.hostContactEpoch ?? 0
      ])
    })
  }
  return hosts
}

export function useAgentHubRequestConsumer(
  threads: readonly AgentPaneThread[],
  lists: AgentHubLists
): void {
  const context = useRef({ threads, lists })
  useEffect(() => {
    context.current = { threads, lists }
  }, [threads, lists])
  useEffect(() => {
    if (isWebClientLocation()) {
      return undefined
    }
    const onError = (error: unknown): void => console.warn('[agent-hub-consumer]', error)
    const consumer = new AgentHubRequestConsumer({
      client: (host) => createAgentHubClient(host === 'local' ? null : host, onError),
      apply: applyAgentHubDelivery,
      clear: clearAgentHubRequestHost,
      execute: (host, request) => executeAgentHubRequest(host, request, context.current),
      onError
    })
    const unregisterResponder = registerAgentHubRequestResponder((host, requestId, result) => {
      const gate = readAgentHubRequests().get(host)?.pendingGates.get(requestId)
      return gate && result.kind === 'ask'
        ? consumer.resolveGate(host, gate, result.answer)
        : consumer.respond(host, requestId, result)
    })
    const update = (state: AppState): void => {
      const enabled =
        state.settings?.experimentalAgentHub === true &&
        state.settings.agentHubAgentControl !== false
      consumer.update(enabled, enabled ? agentHubConsumerHosts(state) : [])
    }
    update(useAppStore.getState())
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (
        state.settings !== previous.settings ||
        state.runtimeEnvironments !== previous.runtimeEnvironments ||
        state.runtimeStatusByEnvironmentId !== previous.runtimeStatusByEnvironmentId
      ) {
        update(state)
      }
    })
    return () => {
      unsubscribe()
      unregisterResponder()
      consumer.dispose()
    }
  }, [])
}
