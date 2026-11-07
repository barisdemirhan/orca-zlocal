import { AGENT_HUB_GATES_CAPABILITY } from '../../../../../shared/agent-hub-capabilities'
import {
  getRegisteredSshState,
  listRegisteredSshTargets
} from '../../../../ssh/targets/ssh-target-registry'
import { getPublicSshState } from '../../../hosts/platform-probe/public-ssh-state'
import { defineMethod, defineStreamingMethod } from '../../core'
import {
  ClientEventsSubscribeParams,
  ClientEventsUnsubscribeParams
} from '../../../../../shared/rpc-contract/client-events-params'
import { BROWSER_CLIENT_HOST_REQUEST_CAPABILITY } from '../../../../../shared/browser/client-hosting/browser-client-host-request-protocol'
import { getBrowserHostRequestRegistry } from '../../../browser-host/leases/browser-host-request-registry'
import { agentHubDesktopId } from '../agent-hub-caller'

let clientEventSubscriptionSeq = 0

export const CLIENT_EVENT_METHODS = [
  defineStreamingMethod({
    name: 'runtime.clientEvents.subscribe',
    permission: 'workspace',
    params: ClientEventsSubscribeParams,
    handler: async (params, ctx, emit) => {
      const { runtime, connectionId, clientKind, pairedDeviceId, clientCapabilities, signal } = ctx
      const desktop = params?.agentHub === false ? null : agentHubDesktopId(ctx)
      const gates = Boolean(desktop && clientCapabilities?.includes(AGENT_HUB_GATES_CAPABILITY))
      await new Promise<void>((resolve) => {
        const unregisterDesktop = desktop ? runtime.agentHub.registerDesktop(desktop) : () => {}
        // Why: mobile discards terminalSideEffects; excluding it stops the
        // per-OSC batch frames from crossing the relay.
        const unsubscribe = runtime.onClientEvent(
          (event) => {
            if (
              event.type === 'agentHub' &&
              (!desktop ||
                (!gates &&
                  (event.event.kind === 'gate' ||
                    (event.event.kind === 'closed' && event.event.gateId))))
            ) {
              return
            }
            emit(event)
          },
          { consumesTerminalSideEffects: clientKind !== 'mobile' }
        )
        const unregisterHostVolunteer =
          params?.browserHostRequests === true &&
          clientKind === 'runtime' &&
          pairedDeviceId &&
          clientCapabilities?.includes(BROWSER_CLIENT_HOST_REQUEST_CAPABILITY)
            ? getBrowserHostRequestRegistry(runtime).register({ pairedDeviceId, emit })
            : undefined

        const seq = ++clientEventSubscriptionSeq
        const subscriptionId = `runtime-client-events-${connectionId ?? 'inproc'}-${seq}`
        let cleaned = false
        const cleanup = (): void => {
          if (cleaned) {
            return
          }
          cleaned = true
          signal?.removeEventListener('abort', onAbort)
          unsubscribe()
          unregisterDesktop()
          unregisterHostVolunteer?.()
          emit({ type: 'end' })
          resolve()
        }
        const onAbort = (): void => runtime.cleanupSubscription(subscriptionId)
        runtime.registerSubscriptionCleanup(subscriptionId, cleanup, connectionId)
        signal?.addEventListener('abort', onAbort, { once: true })
        if (signal?.aborted) {
          onAbort()
          return
        }

        // Why: listener-first snapshotting closes the subscribe race while restoring state missed during disconnects.
        for (const event of runtime.getTerminalSleepClientEventSnapshot?.() ?? []) {
          emit(event)
        }
        for (const event of runtime.getNativeChatLaunchDraftResolutionClientEventSnapshot?.() ??
          []) {
          emit(event)
        }
        const sshStates = listRegisteredSshTargets().flatMap((target) => {
          const state = getPublicSshState(getRegisteredSshState(target.id) ?? null)
          return state ? [{ targetId: target.id, state }] : []
        })
        // Listen before snapshotting to close reload gaps without exposing HUB-private target configuration.
        const snapshot = desktop ? runtime.agentHub.snapshot() : null
        if (snapshot && gates) {
          snapshot.requests.push(...(runtime.getAgentHubGateSnapshot?.() ?? []))
        }
        emit({
          type: 'ready',
          subscriptionId,
          snapshot: {
            sshStates,
            nativeChatQueueFollowUps: runtime.getClientSettings().nativeChatQueueFollowUps,
            ...(snapshot ? { agentHub: snapshot } : {})
          }
        })
      })
    }
  }),
  defineMethod({
    name: 'runtime.clientEvents.unsubscribe',
    permission: 'workspace',
    params: ClientEventsUnsubscribeParams,
    handler: async (params, { runtime, connectionId }) => {
      const expectedPrefix = `runtime-client-events-${connectionId ?? 'inproc'}-`
      if (!params.subscriptionId.startsWith(expectedPrefix)) {
        return { unsubscribed: false }
      }
      runtime.cleanupSubscription(params.subscriptionId)
      return { unsubscribed: true }
    }
  })
] as const
