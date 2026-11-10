import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeRpcResponse } from '../../../shared/runtime-rpc-envelope'
import type {
  AgentHubDelivery,
  AgentHubRequest,
  AgentHubGate
} from '../../../shared/agent-hub-requests'
import { createAgentHubClient } from './agent-hub-client'
import { runtimeEnvironmentSupportsCapability } from '@/runtime/rpc/compatibility/runtime-capability-proof'
import type * as RuntimeRpcClientModule from './rpc/compatibility/runtime-capability-proof'

vi.mock('./rpc/compatibility/runtime-capability-proof', async (importOriginal) => ({
  ...(await importOriginal<typeof RuntimeRpcClientModule>()),
  runtimeEnvironmentSupportsCapability: vi.fn(async () => true)
}))

const request: AgentHubRequest = {
  requestId: '93b0c108-34c6-4e45-9d13-d8f4170d7456',
  kind: 'ask',
  caller: { paneKey: 'pane-1', terminalHandle: 'term-1' },
  target: { paneKey: 'pane-1', terminalHandle: 'term-1' },
  createdAt: 0,
  expiresAt: 100,
  question: 'Go?',
  options: ['Yes', 'No'],
  multi: false
}
function envelope(result: unknown): RuntimeRpcResponse<unknown> {
  return { id: 'r', ok: true, result, _meta: { runtimeId: 'host' } }
}
let localReceive: ((response: RuntimeRpcResponse<unknown>) => void) | undefined
let remoteReceive: ((response: RuntimeRpcResponse<unknown>) => void) | undefined
const unsubscribe = vi.fn()
const localSubscribe = vi.fn(
  (_args: unknown, callback: (response: RuntimeRpcResponse<unknown>) => void) => {
    localReceive = callback
    return Promise.resolve({ unsubscribe, sendBinary: () => {} })
  }
)
const remoteSubscribe = vi.fn(
  (_args: unknown, callbacks: { onResponse: (response: RuntimeRpcResponse<unknown>) => void }) => {
    remoteReceive = callbacks.onResponse
    return Promise.resolve({ unsubscribe, sendBinary: () => {} })
  }
)
const call = vi.fn(async (_args?: { method: string; params?: unknown }) =>
  envelope({ accepted: true, requestId: request.requestId })
)
beforeEach(() => {
  localReceive = undefined
  remoteReceive = undefined
  vi.stubGlobal('window', {
    api: {
      runtime: { subscribe: localSubscribe, call },
      runtimeEnvironments: { subscribe: remoteSubscribe, call }
    }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  call.mockImplementation(async () => envelope({ accepted: true, requestId: request.requestId }))
  vi.clearAllMocks()
})

describe('Agent Hub renderer API boundary', () => {
  it.each([true, false])(
    'preserves invalid_argument only for capable remote hosts (%s)',
    async (supported) => {
      vi.mocked(runtimeEnvironmentSupportsCapability).mockResolvedValueOnce(supported)
      await createAgentHubClient('paired-host').respond(request.requestId, {
        kind: 'error',
        code: 'invalid_argument',
        message: 'Unsupported layout'
      })
      expect(call).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selector: 'paired-host',
          method: 'agentHub.respond',
          params: {
            requestId: request.requestId,
            result: {
              kind: 'error',
              code: supported ? 'invalid_argument' : 'disabled_by_user',
              message: 'Unsupported layout'
            }
          }
        })
      )
    }
  )

  it('keeps valid snapshot requests and progress when a newer host includes unknown kinds', async () => {
    const received: AgentHubDelivery[] = []
    const stop = createAgentHubClient().subscribe((event) => received.push(event))
    const progress = { ...request, kind: 'progress', text: 'Building' }
    localReceive?.(
      envelope({
        type: 'ready',
        snapshot: {
          agentHub: {
            requests: [{ ...request, kind: 'future-request' }, request],
            progress: [{ ...progress, kind: 'future-progress' }, progress]
          }
        }
      })
    )
    expect(received).toEqual([
      {
        kind: 'snapshot',
        snapshot: {
          requests: [request],
          progress: [expect.objectContaining({ kind: 'progress', text: 'Building' })]
        }
      }
    ])
    await Promise.resolve()
    stop()
  })

  it.each([null, 'paired-host'])(
    'restores the snapshot, delivers events and responds to the same host (%s)',
    async (environmentId) => {
      const received: AgentHubDelivery[] = []
      const api = createAgentHubClient(environmentId)
      const stop = api.subscribe((event) => received.push(event))
      if (environmentId) {
        await vi.waitFor(() => expect(remoteReceive).toBeDefined())
      }
      if (environmentId) {
        expect(call).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'runtime.clientCapabilities.update',
            params: {
              clientCapabilities: expect.arrayContaining([
                'agent-hub.requests.v1',
                'agent-hub.gates.v1'
              ])
            }
          })
        )
      }
      const receive = environmentId === null ? localReceive : remoteReceive
      if (!receive) {
        throw new Error('Missing callback')
      }
      receive(
        envelope({
          type: 'ready',
          subscriptionId: 's',
          snapshot: { agentHub: { requests: [request], progress: [] } }
        })
      )
      receive(envelope({ type: 'agentHub', event: request }))
      expect(received).toEqual([
        { kind: 'snapshot', snapshot: { requests: [request], progress: [] } },
        request
      ])
      await expect(
        api.respond(request.requestId, { kind: 'ask', answer: 'Yes', index: 1 })
      ).resolves.toEqual({ requestId: request.requestId, accepted: true })
      expect(call).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'agentHub.respond',
          params: {
            requestId: request.requestId,
            result: { kind: 'ask', answer: 'Yes', index: 1 }
          },
          ...(environmentId ? { selector: environmentId } : {})
        })
      )
      if (environmentId) {
        vi.mocked(runtimeEnvironmentSupportsCapability).mockResolvedValueOnce(false)
        await api.respond(request.requestId, {
          kind: 'error',
          code: 'invalid_argument',
          message: 'Peek cannot open URLs or files from this paired host yet.'
        })
        expect(call).toHaveBeenLastCalledWith(
          expect.objectContaining({
            method: 'agentHub.respond',
            params: {
              requestId: request.requestId,
              result: {
                kind: 'error',
                code: 'disabled_by_user',
                message: 'Peek cannot open URLs or files from this paired host yet.'
              }
            }
          })
        )
      }
      stop()
      if (environmentId) {
        await vi.waitFor(() =>
          expect(
            call.mock.calls.some(
              ([args]) =>
                args?.method === 'runtime.clientCapabilities.update' &&
                JSON.stringify(args.params).includes('agent-hub.requests.v1') === false
            )
          ).toBe(true)
        )
      }
      receive(envelope({ type: 'agentHub', event: request }))
      expect(received).toHaveLength(2)
      expect(unsubscribe).toHaveBeenCalledOnce()
    }
  )

  it('releases a subscription that finishes opening after the consumer unmounted', async () => {
    let resolveSubscription:
      | ((value: Awaited<ReturnType<typeof localSubscribe>>) => void)
      | undefined
    localSubscribe.mockImplementationOnce((_args, callback) => {
      localReceive = callback
      return new Promise((resolve) => {
        resolveSubscription = resolve
      })
    })
    const received: AgentHubDelivery[] = []
    createAgentHubClient().subscribe((event) => received.push(event))()
    if (!resolveSubscription) {
      throw new Error('Missing pending subscription')
    }
    resolveSubscription({ unsubscribe, sendBinary: () => {} })
    await Promise.resolve()
    localReceive?.(envelope({ type: 'agentHub', event: request }))
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(received).toEqual([])
  })

  it('does not advertise or subscribe after a paired consumer is stopped during admission', async () => {
    let resolveUpdate: ((value: RuntimeRpcResponse<unknown>) => void) | undefined
    call.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        })
    )
    const onError = vi.fn()
    const stop = createAgentHubClient('delayed-host', onError).subscribe(() => {})
    await vi.waitFor(() => expect(resolveUpdate).toBeDefined())
    stop()
    resolveUpdate?.(envelope({ clientCapabilities: ['agent-hub.requests.v1'] }))
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(2))
    expect(remoteSubscribe).not.toHaveBeenCalled()
    expect(call).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'runtime.clientCapabilities.update',
        params: { clientCapabilities: expect.not.arrayContaining(['agent-hub.requests.v1']) }
      })
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it.each([
    { code: 'method_not_found', message: 'Unknown method' },
    { code: 'internal_error', message: 'client_capabilities_update_unsupported' }
  ])('silently ignores paired hosts without capability update support (%j)', async (error) => {
    call.mockResolvedValue({
      id: 'r',
      ok: false,
      error,
      _meta: { runtimeId: 'old' }
    })
    const onError = vi.fn()
    const stop = createAgentHubClient('legacy-host', onError).subscribe(() => {})
    await vi.waitFor(() => expect(call).toHaveBeenCalledOnce())
    stop()
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(2))
    expect(remoteSubscribe).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports malformed events and host failures without inventing an accepted response', async () => {
    const onError = vi.fn()
    const received: AgentHubDelivery[] = []
    const api = createAgentHubClient(null, onError)
    const stop = api.subscribe((event) => received.push(event))
    localReceive?.(envelope({ type: 'agentHub', event: { ...request, options: null } }))
    expect(onError).toHaveBeenCalledOnce()
    expect(received).toEqual([])
    call.mockResolvedValueOnce({
      id: 'r',
      ok: false,
      error: { code: 'already_resolved', message: 'Closed' },
      _meta: { runtimeId: 'host' }
    })
    await expect(
      api.respond(request.requestId, { kind: 'ask', answer: 'Yes', index: 1 })
    ).rejects.toMatchObject({ code: 'already_resolved' })
    await Promise.resolve()
    stop()
  })
  it.each([null, 'paired-host'])(
    'resolves a gate on its owning host with a durable mutation envelope (%s)',
    async (host) => {
      const gate: AgentHubGate = {
        ...request,
        kind: 'gate',
        requestId: 'gate_one',
        gateId: 'gate_one',
        runId: 'run_one',
        taskId: 'task_one',
        runTitle: 'Run',
        taskTitle: 'Task',
        multi: false
      }
      const api = createAgentHubClient(host)
      if (!api.resolveGate) {
        throw new Error('Missing gate API')
      }
      await api.resolveGate(gate, 'custom answer')
      expect(call).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ...(host ? { selector: host } : {}),
          method: 'orchestration.gateResolveByUser',
          params: { id: 'gate_one', run: 'run_one', resolution: 'custom answer' },
          envelope: { orchestrationContractVersion: 1, orchestrationRequestId: expect.any(String) }
        })
      )
      call.mockResolvedValueOnce({
        id: 'r',
        ok: false,
        error: { code: 'already_resolved', message: 'Closed' }
      })
      await expect(api.resolveGate(gate, 'late')).rejects.toMatchObject({
        code: 'already_resolved'
      })
    }
  )
})
