import { createRootDispatch } from '../../orchestration/db/root-dispatch-test-fixture'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { RpcContext } from '../core'
import { eraseRpcMethods } from '../core'
import { ORCHESTRATION_GATE_METHODS } from './orchestration/gates/gates'
import { createOrchestrationRpcHarness } from './orchestration/rpc-test-harness'
import { CLIENT_EVENT_METHODS } from './client-events/client-events'
import { AGENT_HUB_ORB_METHODS } from './agent-hub-orb'
import { ClientEventsSubscribeParams } from '../../../../shared/rpc-contract/client-events-params'
import { readAgentHubDelivery } from '../../../../shared/rpc-contract/agent-hub-events'
import {
  AGENT_HUB_GATES_CAPABILITY,
  AGENT_HUB_REQUESTS_CAPABILITY
} from '../../../../shared/agent-hub-capabilities'
import {
  ORCHESTRATION_CONTRACT_VERSION,
  ORCHESTRATION_USER_GATE_RESOLVE_RUNTIME_CAPABILITY
} from '../../../../shared/orchestration/orchestration-runtime-capabilities'
import { RUNTIME_CAPABILITIES } from '../../../../shared/protocol-version'

const harness = createOrchestrationRpcHarness()
let state: ReturnType<typeof harness.setup>
const streams: { stop: AbortController; done: Promise<void> }[] = []
beforeEach(() => {
  state = harness.setup()
  state.runtime.getOrchestrationDb()
  vi.spyOn(state.runtime, 'getClientSettings').mockReturnValue({
    nativeChatQueueFollowUps: true
  } as ReturnType<typeof state.runtime.getClientSettings>)
})
afterEach(async () => {
  for (const stream of streams.splice(0)) {
    stream.stop.abort()
    await stream.done
  }
  state.runtime.agentHub.dispose()
  harness.cleanup()
})
function subscribe(gates: boolean, requests = true) {
  const stop = new AbortController()
  const received: unknown[] = []
  const done = CLIENT_EVENT_METHODS[0].handler(
    ClientEventsSubscribeParams.parse({ agentHub: true }),
    {
      runtime: state.runtime,
      caller: { kind: 'desktop' },
      clientKind: 'runtime',
      signal: stop.signal,
      clientCapabilities: requests
        ? [AGENT_HUB_REQUESTS_CAPABILITY, ...(gates ? [AGENT_HUB_GATES_CAPABILITY] : [])]
        : []
    },
    (event) => received.push(event)
  )
  streams.push({ stop, done })
  return received
}
function createGate() {
  const task = state.db.createTask({ spec: 'Choose a strategy', taskTitle: 'Implementation' })
  return state.db.createGate({
    taskId: task.id,
    question: 'Which strategy?',
    options: ['Small (Recommended)', 'Large']
  })
}

it('refuses Orb methods on disabled hosts and paired desktops before session creation or history reads', async () => {
  const dispatcher = new RpcDispatcher({
    runtime: state.runtime,
    methods: eraseRpcMethods(AGENT_HUB_ORB_METHODS)
  })
  for (const enabled of [false, true]) {
    vi.spyOn(state.runtime, 'isAgentHubEnabled').mockReturnValue(enabled)
    const ctx: RpcContext = {
      runtime: state.runtime,
      caller: enabled ? { kind: 'paired-device', deviceId: 'remote-desktop' } : { kind: 'desktop' },
      clientKind: 'runtime'
    }
    for (const method of AGENT_HUB_ORB_METHODS) {
      if (method.name === 'agentHub.orb.releaseOperation') {
        continue
      }
      const response = await dispatcher.dispatch(
        { id: 'orb', authToken: 'desktop', method: method.name, params: {} },
        {
          caller: ctx.caller,
          clientKind: ctx.clientKind
        }
      )
      // A disabled host still lets its own desktop close a leftover Orb.
      if (!enabled && method.name === 'agentHub.orb.close') {
        expect(response).not.toMatchObject({ error: { code: 'disabled' } })
        continue
      }
      expect(response).toMatchObject({ ok: false, error: { code: 'disabled' } })
    }
  }
})

it.each([{ kind: 'desktop' }, { kind: 'paired-device', deviceId: 'remote-desktop' }] as const)(
  'lets a human $kind take control even after Orb is disabled',
  async (caller) => {
    vi.spyOn(state.runtime, 'isAgentHubEnabled').mockReturnValue(false)
    const dispatcher = new RpcDispatcher({
      runtime: state.runtime,
      methods: eraseRpcMethods(AGENT_HUB_ORB_METHODS)
    })
    const done = Promise.withResolvers<void>()
    const operations = state.runtime.agentHub.orbOperations
    const target = { kind: 'session', sessionId: 'target-chat' } as const
    const pending = operations.run(
      'orb-session',
      target,
      'agentSession.send',
      async () => done.promise
    )
    try {
      const operationId = operations.snapshot()[0]!.requestId
      const refused = await dispatcher.dispatch(
        {
          id: 'agent',
          authToken: 'desktop',
          method: 'agentHub.orb.releaseOperation',
          params: { operationId }
        },
        { caller: { kind: 'local-cli' }, clientKind: 'runtime' }
      )
      expect(refused).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
      expect(operations.canWrite(target)).toBe(false)
      const result = await dispatcher.dispatch(
        {
          id: 'human',
          authToken: 'desktop',
          method: 'agentHub.orb.releaseOperation',
          params: { operationId }
        },
        { caller, clientKind: 'runtime' }
      )
      expect(result).toMatchObject({ ok: true, result: { released: true } })
      expect(operations.canWrite(target)).toBe(true)
    } finally {
      done.resolve()
      await pending
    }
  }
)

it('publishes persisted create, resolve and timeout changes, restoring only pending gates to capable desktops', () => {
  const capable = subscribe(true)
  const old = subscribe(false)
  const unaware = subscribe(false, false)
  const gate = createGate()
  const open = readAgentHubDelivery(capable.at(-1))
  expect(open).toMatchObject({
    kind: 'gate',
    gateId: gate.id,
    runId: state.activeRunId,
    taskTitle: 'Implementation',
    question: 'Which strategy?',
    options: ['Small (Recommended)', 'Large']
  })
  expect(old).toHaveLength(1)
  expect(unaware).toHaveLength(1)
  const reconnected = subscribe(true)
  expect(readAgentHubDelivery(reconnected[0])).toMatchObject({
    kind: 'snapshot',
    snapshot: { requests: [expect.objectContaining({ gateId: gate.id })] }
  })
  expect(readAgentHubDelivery(subscribe(false)[0])).toMatchObject({
    kind: 'snapshot',
    snapshot: { requests: [] }
  })
  state.db.resolveGate(gate.id, 'Small', 'user')
  expect(readAgentHubDelivery(capable.at(-1))).toMatchObject({
    kind: 'closed',
    gateId: gate.id,
    reason: 'responded'
  })
  const timed = createGate()
  state.db.timeoutGate(timed.id)
  expect(readAgentHubDelivery(capable.at(-1))).toMatchObject({
    kind: 'closed',
    gateId: timed.id,
    reason: 'timeout'
  })
  const count = capable.length
  state.db.timeoutGate(timed.id)
  expect(capable).toHaveLength(count)
  expect(readAgentHubDelivery(subscribe(true)[0])).toMatchObject({
    kind: 'snapshot',
    snapshot: { requests: [] }
  })
  expect(old).toHaveLength(1)
})

it('does not publish a gate whose task transition rolled back', () => {
  const received = subscribe(true)
  state.db.db.exec(
    "CREATE TRIGGER refuse_gate BEFORE UPDATE ON tasks WHEN NEW.status = 'blocked' BEGIN SELECT RAISE(ABORT, 'refused'); END;"
  )
  expect(createGate).toThrow('refused')
  expect(received).toHaveLength(1)
})

it('accepts authenticated desktop answers without terminal identity, retaining a durable replay and the advertised capability', async () => {
  const gate = createGate()
  const dispatcher = new RpcDispatcher({
    runtime: state.runtime,
    methods: eraseRpcMethods(ORCHESTRATION_GATE_METHODS)
  })
  const envelope = {
    orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
    orchestrationRequestId: 'gate-answer-1'
  }
  const request = {
    id: 'answer',
    authToken: 'desktop',
    method: 'orchestration.gateResolveByUser',
    params: { id: gate.id, resolution: 'Small', run: gate.run_id },
    ...envelope
  }
  expect(RUNTIME_CAPABILITIES).toContain(ORCHESTRATION_USER_GATE_RESOLVE_RUNTIME_CAPABILITY)
  const first = await dispatcher.dispatch(request, {
    caller: { kind: 'desktop' },
    clientKind: 'runtime'
  })
  expect(first).toMatchObject({
    ok: true,
    result: { gate: { resolution: 'Small', resolved_by: 'user' }, mutation: { replayed: false } }
  })
  expect(
    await dispatcher.dispatch(request, { caller: { kind: 'desktop' }, clientKind: 'runtime' })
  ).toMatchObject({ ok: true, result: { mutation: { replayed: true } } })
  const late = await dispatcher.dispatch(
    {
      ...request,
      orchestrationRequestId: 'gate-answer-2',
      params: { ...request.params, resolution: 'Large' }
    },
    { caller: { kind: 'desktop' }, clientKind: 'runtime' }
  )
  expect(late).toMatchObject({ ok: false, error: { code: 'already_resolved' } })
  await expect(
    harness.call(
      'orchestration.gateResolve',
      { id: gate.id, resolution: 'Coordinator answer' },
      state.ctx
    )
  ).rejects.toMatchObject({ code: 'already_resolved' })
})

it('permits paired desktops, refusing CLI, phone, wrong-run and empty-answer requests without changing the gate', async () => {
  const gate = createGate()
  const method = harness.findMethod('orchestration.gateResolveByUser')
  const params = { id: gate.id, resolution: 'Small' }
  const rejected: RpcContext[] = [
    { runtime: state.runtime, caller: { kind: 'local-cli' }, clientKind: 'runtime' },
    {
      runtime: state.runtime,
      caller: { kind: 'paired-device', deviceId: 'phone' },
      clientKind: 'mobile'
    }
  ]
  const dispatcher = new RpcDispatcher({
    runtime: state.runtime,
    methods: eraseRpcMethods(ORCHESTRATION_GATE_METHODS)
  })
  for (const ctx of rejected) {
    await expect(
      Promise.resolve().then(() => method.handler(method.params?.parse(params), ctx))
    ).rejects.toMatchObject({ code: 'permission_denied' })
    expect(
      await dispatcher.dispatch(
        {
          id: 'denied',
          authToken: 'desktop',
          method: 'orchestration.gateResolveByUser',
          params,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION
        },
        { caller: ctx.caller, clientKind: ctx.clientKind }
      )
    ).toMatchObject({ ok: false, error: { code: 'permission_denied' } })
  }
  const desktop: RpcContext = {
    runtime: state.runtime,
    caller: { kind: 'paired-device', deviceId: 'desktop' },
    clientKind: 'runtime'
  }
  await expect(
    Promise.resolve().then(() =>
      method.handler(method.params?.parse({ ...params, run: 'other' }), desktop)
    )
  ).rejects.toMatchObject({ code: 'request_not_found' })
  expect(() => method.params?.parse({ ...params, resolution: ' ' })).toThrow()
  expect(
    await dispatcher.dispatch(
      {
        id: 'missing',
        authToken: 'desktop',
        method: 'orchestration.gateResolveByUser',
        params: { ...params, id: 'gate_missing' },
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION
      },
      { caller: desktop.caller, clientKind: desktop.clientKind }
    )
  ).toMatchObject({ ok: false, error: { code: 'request_not_found' } })
  expect(state.db.getGate(gate.id)?.status).toBe('pending')
  expect(await method.handler(method.params?.parse(params), desktop)).toMatchObject({
    gate: { resolved_by: 'user' }
  })
})

it('projects the requesting worker pane and agent when its dispatch is known', () => {
  const received = subscribe(true)
  const task = state.db.createTask({ spec: 'worker decision' })
  createRootDispatch(state.db, task.id, 'term_worker', 'tab_worker:leaf_worker')
  vi.spyOn(state.runtime, 'getAgentHubCaller').mockReturnValue({
    terminalHandle: 'term_worker',
    paneKey: 'tab_worker:leaf_worker',
    agentType: 'codex',
    title: 'Worker'
  })
  state.db.createGate({ taskId: task.id, question: 'Proceed?' })
  expect(readAgentHubDelivery(received.at(-1))).toMatchObject({
    kind: 'gate',
    caller: {
      terminalHandle: 'term_worker',
      paneKey: 'tab_worker:leaf_worker',
      agentType: 'codex',
      title: 'Worker'
    }
  })
})
