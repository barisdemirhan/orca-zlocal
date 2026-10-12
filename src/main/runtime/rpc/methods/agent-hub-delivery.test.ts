import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { RuntimeClientEvent } from '../../../../shared/runtime-client-events'
import type { RpcContext } from '../core'
import { AGENT_HUB_REQUESTS_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import { RuntimeClientEventBus } from '../../runtime-client-event-bus'
import { RuntimeSubscriptionRegistry } from '../../runtime-subscription-registry'
import { AgentHubLedger } from '../../agent-hub/agent-hub-ledger'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import { mapDispatcherError } from '../dispatcher-error-response'
import { AGENT_HUB_METHODS } from './agent-hub'
import { CLIENT_EVENT_METHODS } from './client-events'
import { ClientEventsSubscribeParams } from '../../../../shared/rpc-contract/client-events-params'

vi.mock('../../../ssh/ssh-target-registry', () => ({
  listRegisteredSshTargets: () => [],
  getRegisteredSshState: () => null
}))
vi.mock('../../public-ssh-state', () => ({ getPublicSshState: () => null }))

const caller = { paneKey: 'pane-1', terminalHandle: 'term-1', agentType: 'codex', title: 'Worker' }
let bus: RuntimeClientEventBus
let ledger: AgentHubLedger
let registry: RuntimeSubscriptionRegistry
let runtime: OrcaRuntimeService
const active: { controller: AbortController; done: Promise<void> }[] = []
beforeEach(() => {
  bus = new RuntimeClientEventBus({
    makeTitleGateKey: () => '',
    onConsumerAvailabilityChanged: () => {}
  })
  ledger = new AgentHubLedger((event) => bus.emit({ type: 'agentHub', event }))
  registry = new RuntimeSubscriptionRegistry()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these RPC handlers use only the supplied pane lookup, ledger, event bus and subscription registry.
  runtime = {
    agentHub: ledger,
    onClientEvent: bus.on.bind(bus),
    registerSubscriptionCleanup: registry.register.bind(registry),
    cleanupSubscription: registry.cleanup.bind(registry),
    getTerminalSleepClientEventSnapshot: () => [],
    getNativeChatLaunchDraftResolutionClientEventSnapshot: () => [],
    getAgentHubCaller: (handle: string) => (handle === caller.terminalHandle ? caller : null),
    getTerminalHandleForPaneKey: (key: string) =>
      key === caller.paneKey ? caller.terminalHandle : null
  } as unknown as OrcaRuntimeService
})
afterEach(async () => {
  for (const subscription of active.splice(0)) {
    subscription.controller.abort()
    await subscription.done
  }
  ledger.dispose()
})

function subscribe(desktop: string, capable = true, local = false, params?: unknown) {
  const controller = new AbortController()
  const received: unknown[] = []
  const ctx: RpcContext = {
    runtime,
    connectionId: desktop,
    signal: controller.signal,
    clientKind: 'runtime',
    caller: local ? { kind: 'desktop' } : { kind: 'paired-device', deviceId: desktop },
    clientCapabilities: capable ? [AGENT_HUB_REQUESTS_CAPABILITY] : []
  }
  const done = CLIENT_EVENT_METHODS[0].handler(
    ClientEventsSubscribeParams.parse(params),
    ctx,
    (event) => received.push(event)
  )
  active.push({ controller, done })
  return { received, ctx, controller, done }
}

describe('Agent Hub runtime boundary', () => {
  it('delivers requests and responses over the same stream for local and paired desktops, filtering older peers', async () => {
    const local = subscribe('local', true, true)
    const remote = subscribe('remote')
    const legacy = subscribe('legacy', false)
    const notify = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.notify')
    const respond = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.respond')
    if (!notify || !respond) {
      throw new Error('Missing methods')
    }
    const result = await notify.handler(
      {
        callerTerminalHandle: caller.terminalHandle,
        text: 'Ready',
        level: 'done',
        sound: false,
        links: []
      },
      { runtime }
    )
    const expected = {
      type: 'agentHub',
      event: expect.objectContaining({ kind: 'notify', requestId: result.requestId, caller })
    }
    expect(local.received).toContainEqual(expected)
    expect(remote.received).toContainEqual(expected)
    expect(legacy.received).not.toContainEqual(expected)
    expect(legacy.received[0]).toEqual({
      type: 'ready',
      subscriptionId: expect.any(String),
      snapshot: { sshStates: [] }
    })
    expect(
      respond.handler({ requestId: result.requestId, result: { kind: 'ack' } }, remote.ctx)
    ).toEqual({ requestId: result.requestId, accepted: true })
    expect(local.received.at(-1)).toMatchObject({
      type: 'agentHub',
      event: { kind: 'closed', reason: 'responded' }
    })
    expect(() =>
      respond.handler({ requestId: result.requestId, result: { kind: 'ack' } }, local.ctx)
    ).toThrow(expect.objectContaining({ code: 'already_resolved' }))
  })

  it('restores the ledger on subscribe and removes desktop authority on abort', async () => {
    const first = subscribe('first')
    const notify = ledger.notify(caller, caller, {
      text: 'Ready',
      level: 'info',
      sound: false,
      links: []
    })
    ledger.updateProgress(caller, caller, 'Building')
    const reconnected = subscribe('reconnected')
    expect(reconnected.received[0]).toMatchObject({
      type: 'ready',
      snapshot: {
        agentHub: {
          requests: [expect.objectContaining({ requestId: notify.requestId })],
          progress: [expect.objectContaining({ text: 'Building' })]
        }
      }
    })
    first.controller.abort()
    reconnected.controller.abort()
    await Promise.all([first.done, reconnected.done])
    expect(() =>
      ledger.notify(caller, caller, { text: 'Done', level: 'done', sound: false, links: [] })
    ).toThrow(expect.objectContaining({ code: 'no_desktop' }))
    expect(() => ledger.respond(notify.requestId, { kind: 'ack' }, 'device:first')).toThrow(
      expect.objectContaining({ code: 'no_desktop' })
    )
  })

  it('does not let CLI callers or phones claim desktop responder authority', () => {
    subscribe('desktop')
    const { requestId } = ledger.notify(caller, caller, {
      text: 'Ready',
      level: 'info',
      sound: false,
      links: []
    })
    const respond = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.respond')
    if (!respond) {
      throw new Error('Missing respond')
    }
    for (const ctx of [
      { runtime, caller: { kind: 'local-cli' as const } },
      {
        runtime,
        caller: { kind: 'paired-device' as const, deviceId: 'phone' },
        clientKind: 'mobile' as const,
        clientCapabilities: [AGENT_HUB_REQUESTS_CAPABILITY]
      }
    ]) {
      expect(() => respond.handler({ requestId, result: { kind: 'ack' } }, ctx)).toThrow(
        expect.objectContaining({ code: 'no_desktop' })
      )
    }
  })

  it('keeps structured failure codes and recovery data in RPC errors', () => {
    const response = mapDispatcherError(
      { id: 'r', authToken: 'test', method: 'agentHub.notify' },
      { runtimeId: 'host' },
      new AgentHubError('rate_limited', 'Wait', { retryAfterMs: 100 })
    )
    expect(response).toEqual({
      id: 'r',
      ok: false,
      error: { code: 'rate_limited', message: 'Wait', data: { retryAfterMs: 100 } },
      _meta: { runtimeId: 'host' }
    })
  })

  it('still broadcasts ordinary client events to older peers', () => {
    const legacy = subscribe('legacy', false)
    const event: RuntimeClientEvent = { type: 'reposChanged' }
    bus.emit(event)
    expect(legacy.received.at(-1)).toEqual(event)
  })

  it.each([undefined, null])(
    'admits legacy client-event subscriptions with %s params',
    (params) => {
      const legacy = subscribe('legacy', false, false, params)
      expect(legacy.received[0]).toMatchObject({ type: 'ready', snapshot: { sshStates: [] } })
      expect(legacy.received[0]).not.toHaveProperty('snapshot.agentHub')
    }
  )
})
