import {
  getRegisteredSshState,
  listRegisteredSshTargets
} from '../../../ssh/targets/ssh-target-registry'
import { getPublicSshState } from '../../public-ssh-state'
import { defineMethod, defineStreamingMethod } from '../core'
import {
  ClientEventsSubscribeParams,
  ClientEventsUnsubscribeParams
} from '../../../../shared/rpc-contract/client-events-params'
import { agentHubDesktopId } from './agent-hub-caller'

let clientEventSubscriptionSeq = 0

export const CLIENT_EVENT_METHODS = [
  defineStreamingMethod({
    name: 'runtime.clientEvents.subscribe',
    permission: 'workspace',
    params: ClientEventsSubscribeParams,
    handler: async (_params, ctx, emit) => {
      const { runtime, connectionId, clientKind, signal } = ctx
      const desktop = agentHubDesktopId(ctx)
      await new Promise<void>((resolve) => {
        const unregisterDesktop = desktop ? runtime.agentHub.registerDesktop(desktop) : () => {}
        // Why: mobile discards terminalSideEffects; excluding it stops the
        // per-OSC batch frames from crossing the relay.
        const unsubscribe = runtime.onClientEvent(
          (event) => {
            if (event.type === 'agentHub' && !desktop) {
              return
            }
            emit(event)
          },
          { consumesTerminalSideEffects: clientKind !== 'mobile' }
        )

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
        // Why: attaching the listener before snapshotting closes the reload gap without exposing HUB-private target configuration.
        emit({
          type: 'ready',
          subscriptionId,
          snapshot: { sshStates, ...(desktop ? { agentHub: runtime.agentHub.snapshot() } : {}) }
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
