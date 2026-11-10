import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { RuntimeClientEvent } from '../../../../shared/runtime-client-events'
import type { RpcContext } from '../core'
import { AGENT_HUB_REQUESTS_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import { RuntimeClientEventBus } from '../../client/events/runtime-client-event-bus'
import { RuntimeSubscriptionRegistry } from '../../client/runtime-subscription-registry'
import { AgentHubLedger } from '../../agent-hub/agent-hub-ledger'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import { mapDispatcherError } from '../dispatcher-error-response'
import { AGENT_HUB_METHODS } from './agent-hub'
import { CLIENT_EVENT_METHODS } from './client-events/client-events'
import { ClientEventsSubscribeParams } from '../../../../shared/rpc-contract/client-events-params'
import { resolveAgentHubPanes } from './agent-hub-caller'
import { readAgentHubDelivery } from '../../../../shared/rpc-contract/agent-hub-events'

vi.mock('../../../ssh/targets/ssh-target-registry', () => ({
  listRegisteredSshTargets: () => [],
  getRegisteredSshState: () => null
}))
vi.mock('../../hosts/platform-probe/public-ssh-state', () => ({ getPublicSshState: () => null }))

const caller = { paneKey: 'pane-1', terminalHandle: 'term-1', agentType: 'codex', title: 'Worker' }
let bus: RuntimeClientEventBus
let ledger: AgentHubLedger
let registry: RuntimeSubscriptionRegistry
let runtime: OrcaRuntimeService
const orbCurrent = vi.fn(() => ({ sessionId: 'codex_orb', resumed: false }))
const active: { controller: AbortController; done: Promise<void> }[] = []
beforeEach(() => {
  orbCurrent.mockReset().mockReturnValue({ sessionId: 'codex_orb', resumed: false })
  bus = new RuntimeClientEventBus({
    makeTitleGateKey: () => '',
    onConsumerAvailabilityChanged: () => {}
  })
  ledger = new AgentHubLedger((event) => bus.emit({ type: 'agentHub', event }))
  registry = new RuntimeSubscriptionRegistry()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these RPC handlers use only the supplied pane lookup, ledger, event bus and subscription registry.
  runtime = {
    agentHub: ledger,
    agentHubOrb: { current: orbCurrent },
    onClientEvent: bus.on.bind(bus),
    registerSubscriptionCleanup: registry.register.bind(registry),
    cleanupSubscription: registry.cleanup.bind(registry),
    getTerminalSleepClientEventSnapshot: () => [],
    getClientSettings: () => ({}),
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
  it('delivers an Orb question to the desktop Inbox and sends the human answer back over the waiting CLI request', async () => {
    const desktop = subscribe('local', true, true)
    const ask = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.ask')
    const respond = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.respond')
    if (!ask || !respond) {
      throw new Error('Missing methods')
    }
    const answer = ask.handler(
      ask.params.parse({
        callerSessionId: 'codex_orb',
        question: 'Proceed?',
        options: ['Yes', 'No']
      }),
      { runtime, caller: { kind: 'local-cli' } }
    )
    const event = readAgentHubDelivery(desktop.received.at(-1))
    expect(event).toMatchObject({
      kind: 'ask',
      caller: { kind: 'orb', sessionId: 'codex_orb', title: 'Orb' }
    })
    if (!event || event.kind !== 'ask') {
      throw new Error('No Orb question')
    }
    respond.handler(
      { requestId: event.requestId, result: { kind: 'ask', answer: 'Yes', index: 1 } },
      desktop.ctx
    )
    await expect(answer).resolves.toMatchObject({ answer: 'Yes', index: 1 })
  })

  it.each(['peek', 'mirror', 'arrange', 'canvas'] as const)(
    'requires an explicit pane target for Orb %s and retains existing cross-pane consent',
    (operation) => {
      const ctx: RpcContext = { runtime, caller: { kind: 'local-cli' } }
      expect(() => resolveAgentHubPanes({ callerSessionId: 'codex_orb' }, ctx, operation)).toThrow(
        `Orb cannot ${operation} without a target; pass --terminal`
      )
      expect(
        resolveAgentHubPanes(
          { callerSessionId: 'codex_orb', terminal: caller.terminalHandle },
          ctx,
          operation
        )
      ).toMatchObject({
        caller: { kind: 'orb', sessionId: 'codex_orb' },
        target: { paneKey: caller.paneKey }
      })
    }
  )

  it('carries an Orb mirror add into a named card and returns where the tab landed', async () => {
    const desktop = subscribe('local', true, true)
    const mirror = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.mirror')
    const respond = AGENT_HUB_METHODS.find((method) => method.name === 'agentHub.respond')
    if (!mirror || !respond) {
      throw new Error('Missing methods')
    }
    const ctx: RpcContext = { runtime, caller: { kind: 'local-cli' } }
    const params = { callerSessionId: 'codex_orb', action: 'add', terminal: caller.terminalHandle }
    expect(() =>
      mirror.handler(mirror.params.parse({ ...params, into: 'term-gone' }), ctx)
    ).toThrow('The --into terminal was not found on this host')
    const added = mirror.handler(
      mirror.params.parse({ ...params, into: caller.terminalHandle }),
      ctx
    )
    const into = { paneKey: caller.paneKey, terminalHandle: caller.terminalHandle }
    const consent = readAgentHubDelivery(desktop.received.at(-1))
    expect(consent).toMatchObject({ kind: 'consent', operation: { kind: 'mirror', into } })
    if (consent?.kind !== 'consent') {
      throw new Error('No consent request')
    }
    respond.handler(
      { requestId: consent.requestId, result: { kind: 'consent', decision: 'once' } },
      desktop.ctx
    )
    await vi.waitFor(() =>
      expect(readAgentHubDelivery(desktop.received.at(-1))).toMatchObject({ kind: 'mirror' })
    )
    const event = readAgentHubDelivery(desktop.received.at(-1))
    expect(event).toMatchObject({ kind: 'mirror', action: 'add', into })
    if (event?.kind !== 'mirror') {
      throw new Error('No mirror request')
    }
    respond.handler(
      { requestId: event.requestId, result: { kind: 'ack', mirror: 'added' } },
      desktop.ctx
    )
    await expect(added).resolves.toMatchObject({ mirror: 'added' })
  })

  it('refuses ordinary structured sessions and cross-host Orb identity claims', () => {
    expect(() =>
      resolveAgentHubPanes(
        { callerSessionId: 'ordinary_session' },
        { runtime, caller: { kind: 'local-cli' } }
      )
    ).toThrow('Caller does not identify a pane on this host')
    expect(() =>
      resolveAgentHubPanes(
        { callerSessionId: 'codex_orb' },
        { runtime, caller: { kind: 'paired-device', deviceId: 'remote' } }
      )
    ).toThrow('Caller does not identify a pane on this host')
  })
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

  it('does not keep desktop authority alive through a generic stream after the hub consumer stops', async () => {
    const generic = subscribe('desktop', true, false, { agentHub: false })
    expect(generic.received[0]).not.toHaveProperty('snapshot.agentHub')
    const consumer = subscribe('desktop', true, false, { agentHub: true })
    const notified = ledger.notify(caller, caller, {
      text: 'Ready',
      level: 'info',
      sound: false,
      links: []
    })
    expect(consumer.received).toContainEqual(expect.objectContaining({ type: 'agentHub' }))
    expect(generic.received).not.toContainEqual(expect.objectContaining({ type: 'agentHub' }))
    consumer.controller.abort()
    await consumer.done
    expect(() =>
      ledger.notify(caller, caller, { text: 'Ready', level: 'info', sound: false, links: [] })
    ).toThrow(expect.objectContaining({ code: 'no_desktop' }))
    expect(() => ledger.respond(notified.requestId, { kind: 'ack' }, 'device:desktop')).toThrow(
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
