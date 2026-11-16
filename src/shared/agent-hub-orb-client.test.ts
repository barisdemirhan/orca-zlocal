import { expect, it, vi } from 'vitest'
import { createAgentHubOrbApi, createDisabledAgentHubOrbApi } from './agent-hub-orb-client'
import type { RuntimeRpcResponse } from './remote-runtime/rpc/runtime-rpc-envelope'

it('routes Orb reads and opens over the existing runtime transport and validates host responses', async () => {
  const call = vi.fn(async (): Promise<RuntimeRpcResponse<unknown>> => ({
    id: 'call',
    ok: true,
    result: { sessionId: 'orb_session', resumed: false },
    _meta: { runtimeId: 'host' }
  }))
  const api = createAgentHubOrbApi(call)
  await expect(api.open({ agent: 'codex', model: null })).resolves.toEqual({
    sessionId: 'orb_session',
    resumed: false
  })
  expect(call).toHaveBeenLastCalledWith({
    method: 'agentHub.orb.open',
    params: { agent: 'codex', model: null }
  })
  call.mockResolvedValue({ id: 'call', ok: true, result: null, _meta: { runtimeId: 'host' } })
  await expect(api.current()).resolves.toBeNull()
  call.mockResolvedValue({ id: 'call', ok: true, result: [], _meta: { runtimeId: 'host' } })
  await expect(api.list({ limit: 5 })).resolves.toEqual([])
  expect(call).toHaveBeenLastCalledWith({ method: 'agentHub.orb.list', params: { limit: 5 } })
  call.mockResolvedValue({ id: 'call', ok: true, result: null, _meta: { runtimeId: 'host' } })
  await expect(api.close()).resolves.toBeUndefined()
  expect(call).toHaveBeenLastCalledWith({ method: 'agentHub.orb.close', params: {} })
  call.mockResolvedValue({
    id: 'call',
    ok: false,
    error: { code: 'disabled', message: 'Disabled' }
  })
  await expect(api.open()).rejects.toMatchObject({ code: 'disabled' })
})

it('refuses every paired web entry point without transport effects', async () => {
  const api = createDisabledAgentHubOrbApi()
  for (const request of [
    () => api.open(),
    () => api.current(),
    () => api.close(),
    () => api.list()
  ]) {
    await expect(request()).rejects.toMatchObject({ code: 'disabled' })
  }
})
