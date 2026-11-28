import type {
  AgentSessionVoiceCapability,
  AgentSessionVoiceEvent,
  AgentSessionVoiceOwner,
  AgentSessionVoiceResult
} from '../../../shared/agent-session-voice'
import {
  agentSessionVoiceStartFields,
  agentSessionVoiceStopFields
} from '../../../shared/agent-session-voice'
import type { AgentSessionMutationResult } from '../../../shared/agent-session/agent-session-wire'
import type { RuntimeEnvironmentStatus } from '../../../shared/remote-runtime/host-status/runtime-host-status'
import { structuredAgentSessionPayloadFingerprint } from '../../../shared/agent-session/lifecycle/operations/structured-agent-session-mutation'
import type { RuntimeClientTarget } from '../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { getRuntimeEnvironmentRevision } from './rpc/environment-revisions/runtime-environment-revision'
import { runtimeHostConnectionStateForEntry } from './hosts/connections/runtime-host-connection-state'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { callStructuredAgentSession } from './native-chat/requests/structured-agent-session-call'
import { subscribeStructuredAgentSessionMethod } from './native-chat/requests/structured-agent-session-subscriptions'
import type {
  StructuredAgentSessionWrite,
  StructuredAgentSessionVoiceStartObserver
} from '../components/native-chat/session/structured/writes/use-structured-agent-session-mutate'
import { structuredSessionOperationId } from '../components/native-chat/session/structured/writes/structured-agent-session-operation-id'
import { appendAgentSessionVoiceText } from './agent-session-voice-text-client'

export class AgentSessionVoiceRefusal extends Error {}

function captureVoiceTransport(
  target: RuntimeClientTarget,
  readStatus: () => RuntimeEnvironmentStatus | undefined
) {
  if (target.kind === 'local') {
    const runtime = window.api.runtime
    return { current: () => window.api.runtime === runtime }
  }
  const pairingRevision = getRuntimeEnvironmentRevision(target.environmentId)
  const status = readStatus()
  const runtimeId = status?.status?.runtimeId
  const connectionGeneration = status?.connectionGeneration
  const runtime = window.api.runtimeEnvironments
  return {
    options: {
      skipCompatibilityCheck: true,
      expectedEnvironmentPairingRevision: pairingRevision,
      expectedEnvironmentRuntimeId: runtimeId
    } as const,
    current: () => {
      const current = readStatus()
      return (
        pairingRevision !== undefined &&
        runtimeId !== undefined &&
        connectionGeneration !== undefined &&
        window.api.runtimeEnvironments === runtime &&
        getRuntimeEnvironmentRevision(target.environmentId) === pairingRevision &&
        current?.connectionGeneration === connectionGeneration &&
        current.status?.runtimeId === runtimeId &&
        runtimeHostConnectionStateForEntry(current) === 'connected'
      )
    }
  }
}

export function createAgentSessionVoiceClient(
  target: RuntimeClientTarget,
  sessionId: string,
  write: StructuredAgentSessionWrite,
  readStatus: () => RuntimeEnvironmentStatus | undefined
) {
  type Cleanup = AgentSessionVoiceOwner & {
    fence: number | null
    transport: ReturnType<typeof captureVoiceTransport>
    stopping?: Promise<AgentSessionVoiceResult>
    connected: boolean
  }
  let cleanup: Cleanup | null = null
  const mutation = async (
    method: string,
    fields: Record<string, unknown>,
    observer?: StructuredAgentSessionVoiceStartObserver
  ): Promise<AgentSessionVoiceResult> => {
    const outcome = await write<AgentSessionVoiceResult>(method, method, fields, observer)
    if (outcome.kind !== 'done') {
      throw new AgentSessionVoiceRefusal(
        outcome.kind === 'not-done'
          ? outcome.notice
          : 'The conversation changed before voice could connect.'
      )
    }
    return outcome.value
  }
  const stopOwned = async (owner: Cleanup): Promise<AgentSessionVoiceResult> => {
    if (owner.fence === null || !owner.connected || !owner.transport.current()) {
      throw new AgentSessionVoiceRefusal('The voice connection closure could not be verified.')
    }
    const method = 'agentSession.stopVoice'
    const fields = agentSessionVoiceStopFields(owner)
    const params = {
      envelope: {
        sessionId,
        clientOperationId: structuredSessionOperationId(),
        expectedRuntimeFence: owner.fence,
        payloadFingerprint: structuredAgentSessionPayloadFingerprint({ method, sessionId, fields })
      },
      ...fields
    }
    const result = owner.transport.options
      ? await callRuntimeRpc<AgentSessionMutationResult<AgentSessionVoiceResult>>(
          target,
          method,
          params,
          owner.transport.options
        )
      : await callRuntimeRpc<AgentSessionMutationResult<AgentSessionVoiceResult>>(
          target,
          method,
          params
        )
    if (
      !owner.connected ||
      !owner.transport.current() ||
      !result.ok ||
      result.value.voiceSessionId !== owner.voiceSessionId ||
      result.value.generation !== owner.generation
    ) {
      throw new AgentSessionVoiceRefusal('The voice connection closure could not be verified.')
    }
    return result.value
  }
  return {
    appendText: async (owner: AgentSessionVoiceOwner, text: string): Promise<boolean> => {
      const current = cleanup
      if (
        !current ||
        current.fence === null ||
        current.stopping ||
        !current.connected ||
        current.voiceSessionId !== owner.voiceSessionId ||
        current.generation !== owner.generation ||
        !current.transport.current()
      ) {
        return false
      }
      const applied = await appendAgentSessionVoiceText(
        target,
        sessionId,
        current.fence,
        owner,
        text,
        current.transport.options
      )
      return cleanup === current && current.connected && current.transport.current() && applied
    },
    capability: () =>
      callStructuredAgentSession<AgentSessionVoiceCapability>(
        target,
        'agentSession.voiceCapability',
        { sessionId }
      ),
    subscribe: (
      owner: AgentSessionVoiceOwner,
      onEvent: (event: AgentSessionVoiceEvent) => void,
      onFailure: () => void
    ) => {
      let disposed = false
      const lost = (): void => {
        if (!disposed) {
          if (
            cleanup?.voiceSessionId === owner.voiceSessionId &&
            cleanup.generation === owner.generation
          ) {
            cleanup.connected = false
          }
          onFailure()
        }
      }
      return subscribeStructuredAgentSessionMethod<AgentSessionVoiceEvent>(
        target,
        'agentSession.subscribeVoice',
        { sessionId, voiceSessionId: owner.voiceSessionId, generation: owner.generation },
        onEvent,
        lost,
        lost
      ).then((subscription) => ({
        unsubscribe: () => {
          disposed = true
          subscription.unsubscribe()
        }
      }))
    },
    start: (owner: AgentSessionVoiceOwner, sdp: string) => {
      const attempt: Cleanup = {
        voiceSessionId: owner.voiceSessionId,
        generation: owner.generation,
        fence: null,
        connected: true,
        transport: captureVoiceTransport(target, readStatus)
      }
      cleanup = attempt
      return mutation('agentSession.startVoice', agentSessionVoiceStartFields({ ...owner, sdp }), {
        issued: (fence) => {
          attempt.fence = fence
        },
        confirmed: (fence) => {
          attempt.fence = fence
        }
      })
    },
    stop: (owner: AgentSessionVoiceOwner) => {
      if (
        !cleanup ||
        cleanup.voiceSessionId !== owner.voiceSessionId ||
        cleanup.generation !== owner.generation
      ) {
        return Promise.reject(new AgentSessionVoiceRefusal('This voice attempt is unavailable.'))
      }
      const active = cleanup
      // A refused or unverifiable stop must be retryable.
      active.stopping ??= stopOwned(active).then(
        (result) => {
          if (result.state !== 'off') {
            delete active.stopping
          }
          return result
        },
        (error) => {
          delete active.stopping
          throw error
        }
      )
      return active.stopping
    }
  }
}

export type AgentSessionVoiceClient = ReturnType<typeof createAgentSessionVoiceClient>
