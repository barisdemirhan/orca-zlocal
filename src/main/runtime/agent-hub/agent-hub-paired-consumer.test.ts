import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from '../orca-runtime'
import { OrcaRuntimeRpcServer } from '../rpc/server/runtime-rpc'
import { RemoteRuntimeSharedControlConnection } from '../../../shared/remote-runtime/control/remote-runtime-shared-control-connection'
import { pairedRuntimeConnectionFromOffer } from '../../../shared/remote-runtime/pairing/paired-runtime-connection'
import { remoteRuntimeClientCapabilities } from '../../../shared/remote-runtime/remote-runtime-client-capabilities'
import { readAgentHubDelivery } from '../../../shared/rpc-contract/agent-hub-events'

function subscriptionId(frames: unknown[]): string | undefined {
  for (const frame of frames) {
    if (
      typeof frame === 'object' &&
      frame !== null &&
      'subscriptionId' in frame &&
      typeof frame.subscriptionId === 'string'
    ) {
      return frame.subscriptionId
    }
  }
  return undefined
}

describe('Agent Hub consumer on an authenticated paired socket', () => {
  it.each(['runtime', 'mobile'] as const)(
    'updates capabilities without admitting a mobile or ordinary event stream (%s)',
    async (scope) => {
      const userDataPath = mkdtempSync(join(tmpdir(), 'orca-hub-paired-'))
      const runtime = new OrcaRuntimeService()
      vi.spyOn(runtime, 'getClientSettings').mockReturnValue({} as never)
      const server = new OrcaRuntimeRpcServer({
        runtime,
        userDataPath,
        enableWebSocket: true,
        wsPort: 0
      })
      let connection: RemoteRuntimeSharedControlConnection | undefined
      try {
        await server.start()
        const device = server.getDeviceRegistry()?.addDevice('fixture-peer', scope)
        const publicKeyB64 = server.getE2EEPublicKey()
        const endpoint = server.getWebSocketEndpoint()
        if (!device || !publicKeyB64 || !endpoint) {
          throw new Error('Missing paired socket fixture')
        }
        connection = new RemoteRuntimeSharedControlConnection(
          pairedRuntimeConnectionFromOffer({ endpoint, publicKeyB64, deviceToken: device.token })
        )
        const capabilities = [...remoteRuntimeClientCapabilities(), 'agent-hub.requests.v1']
        expect(
          await connection.request(
            'runtime.clientCapabilities.update',
            { clientCapabilities: capabilities },
            2_000
          )
        ).toMatchObject({ ok: true, result: { clientCapabilities: capabilities } })
        const caller = { paneKey: 'fixture-pane', terminalHandle: 'fixture-terminal' }
        const genericFrames: unknown[] = []
        const onError = vi.fn()
        await connection.subscribe('runtime.clientEvents.subscribe', { agentHub: false }, 2_000, {
          onResponse: (response) => {
            if (response.ok) {
              genericFrames.push(response.result)
            }
          },
          onError
        })
        await vi.waitFor(() => expect(subscriptionId(genericFrames)).toBeDefined())
        await expect(runtime.agentHub.status(caller, caller)).rejects.toMatchObject({
          code: 'no_desktop'
        })
        const consumerFrames: unknown[] = []
        await connection.subscribe('runtime.clientEvents.subscribe', { agentHub: true }, 2_000, {
          onResponse: (response) => {
            if (response.ok) {
              consumerFrames.push(response.result)
            }
          },
          onError
        })
        await vi.waitFor(() => expect(subscriptionId(consumerFrames)).toBeDefined())
        if (scope === 'mobile') {
          expect(consumerFrames.map(readAgentHubDelivery)).toEqual([null])
          await expect(runtime.agentHub.status(caller, caller)).rejects.toMatchObject({
            code: 'no_desktop'
          })
        } else {
          expect(consumerFrames.map(readAgentHubDelivery)).toContainEqual({
            kind: 'snapshot',
            snapshot: { requests: [], progress: [] }
          })
          const answer = runtime.agentHub.status(caller, caller)
          await vi.waitFor(() =>
            expect(
              consumerFrames.some((frame) => readAgentHubDelivery(frame)?.kind === 'status')
            ).toBe(true)
          )
          const request = runtime.agentHub
            .snapshot()
            .requests.find((item) => item.kind === 'status')
          if (!request) {
            throw new Error('Missing delivered status request')
          }
          expect(
            await connection.request(
              'agentHub.respond',
              {
                requestId: request.requestId,
                result: { kind: 'status', mirrors: [], parked: [], waiting: [] }
              },
              2_000
            )
          ).toMatchObject({ ok: true, result: { accepted: true } })
          await expect(answer).resolves.toEqual({ mirrors: [], parked: [], waiting: [] })
          expect(genericFrames.map(readAgentHubDelivery)).toEqual([null])
        }
        expect(
          await connection.request(
            'runtime.clientEvents.unsubscribe',
            { subscriptionId: subscriptionId(consumerFrames) },
            2_000
          )
        ).toMatchObject({ ok: true, result: { unsubscribed: true } })
        expect(
          await connection.request(
            'runtime.clientCapabilities.update',
            { clientCapabilities: remoteRuntimeClientCapabilities() },
            2_000
          )
        ).toMatchObject({ ok: true })
        await expect(runtime.agentHub.status(caller, caller)).rejects.toMatchObject({
          code: 'no_desktop'
        })
        expect(onError).not.toHaveBeenCalled()
      } finally {
        connection?.close()
        runtime.agentHub.dispose()
        await server.stop()
        rmSync(userDataPath, { recursive: true, force: true })
      }
    }
  )
})
