import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeRpcResponse } from '../../../shared/runtime-rpc-envelope'
import type { AgentHubDelivery, AgentHubRequest } from '../../../shared/agent-hub-requests'
import { createAgentHubClient } from './agent-hub-client'

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
const call = vi.fn(async () => envelope({ accepted: true, requestId: request.requestId }))
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
  vi.clearAllMocks()
})

describe('Agent Hub renderer API boundary', () => {
  it.each([null, 'paired-host'])(
    'restores the snapshot, delivers events and responds to the same host (%s)',
    async (environmentId) => {
      const received: AgentHubDelivery[] = []
      const api = createAgentHubClient(environmentId)
      const stop = api.subscribe((event) => received.push(event))
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
      stop()
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
})
