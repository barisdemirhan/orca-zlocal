import { beforeEach, describe, expect, it, vi } from 'vitest'

const callRuntimeRpc = vi.hoisted(() => vi.fn())
vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc }))

import { callHostRoute, HostRouteUnverifiableError } from './host-route-call'
import { replaceRuntimeEnvironmentRevisions } from './runtime-environment-revision'
import {
  clearRuntimeEnvironmentConnectionGenerationsForTests,
  setRuntimeEnvironmentConnectionGenerationForTests
} from '@/store/slices/runtime-status'

const route = { target: { kind: 'environment', environmentId: 'env-1' }, at: 'local' } as const

beforeEach(() => {
  callRuntimeRpc.mockReset()
  clearRuntimeEnvironmentConnectionGenerationsForTests()
  replaceRuntimeEnvironmentRevisions([{ id: 'env-1', createdAt: 1, pairingRevision: 7 }])
})

describe('callHostRoute', () => {
  it.each([
    ['folderWorkspace.update', { id: 'f' }],
    ['agentHub.progress', { text: 'Reviewing the change' }]
  ] as const)(
    'calls %s on its route target with the pairing revision captured before the call',
    async (method, params) => {
      callRuntimeRpc.mockResolvedValue({ ok: true })
      const signal = new AbortController().signal

      await expect(
        callHostRoute(route, method, params, {
          timeoutMs: 5,
          signal,
          expectedEnvironmentRuntimeId: 'runtime-a'
        })
      ).resolves.toEqual({ ok: true })
      expect(callRuntimeRpc).toHaveBeenCalledWith(route.target, method, params, {
        timeoutMs: 5,
        signal,
        expectedEnvironmentRuntimeId: 'runtime-a',
        expectedEnvironmentPairingRevision: 7
      })
    }
  )

  it('reports a reply from a replaced runtime as unverifiable instead of applying it', async () => {
    callRuntimeRpc.mockImplementation(async () => {
      setRuntimeEnvironmentConnectionGenerationForTests('env-1', 1)
      return { ok: true }
    })

    const call = callHostRoute(route, 'folderWorkspace.update', {})
    await expect(call).rejects.toBeInstanceOf(HostRouteUnverifiableError)
    await expect(call).rejects.toMatchObject({ verdict: 'unverifiable' })
    expect(callRuntimeRpc).toHaveBeenCalledOnce()
  })

  it('refuses client effects and unclassified methods without calling a host', async () => {
    await expect(callHostRoute(route, 'shell.openPath', {})).rejects.toThrow(
      'not a host-owned operation'
    )
    await expect(callHostRoute(route, 'mystery.call', {})).rejects.toThrow(
      'not a host-owned operation'
    )
    expect(callRuntimeRpc).not.toHaveBeenCalled()
  })
})
