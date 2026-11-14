/** Agent Hub consumers must opt in through the trusted desktop renderer. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeCapability } from '../../shared/protocol-version'
import {
  AGENT_HUB_REQUESTS_CAPABILITY,
  AGENT_HUB_GATES_CAPABILITY
} from '../../shared/agent-hub-capabilities'
import type { RpcCallerIdentity } from '../runtime/rpc/callers/rpc-caller-identity'

type AdvertisedClient = {
  clientKind?: 'mobile' | 'runtime'
  clientCapabilities?: readonly RuntimeCapability[]
  caller?: RpcCallerIdentity
  pairedDeviceId?: string
  connectionId?: string
}

const { handlers, advertised } = vi.hoisted(
  (): {
    handlers: Map<string, (event: unknown, args?: unknown) => unknown>
    advertised: { unary: AdvertisedClient[]; streaming: AdvertisedClient[]; requests: unknown[] }
  } => ({
    handlers: new Map(),
    advertised: { unary: [], streaming: [], requests: [] }
  })
)

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    }),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    removeHandler: vi.fn()
  }
}))

vi.mock('../runtime/rpc/dispatcher', () => ({
  RpcDispatcher: class {
    dispatch(request: unknown, options: AdvertisedClient): Promise<unknown> {
      advertised.unary.push(options)
      advertised.requests.push(request)
      return Promise.resolve({ ok: true, result: {} })
    }

    dispatchStreamingObjects(
      _request: unknown,
      _emit: (response: unknown) => void,
      options: AdvertisedClient
    ): Promise<void> {
      advertised.streaming.push(options)
      // Keep streaming open; the handler attaches only a cleanup callback.
      return new Promise<void>(() => {})
    }
  }
}))

const { registerRuntimeHandlers } = await import('./runtime')
const { agentHubDesktopId } = await import('../runtime/rpc/methods/agent-hub-caller')
const { setTrustedUIRendererWebContentsId } = await import('./ui')

function rendererEvent() {
  const mainFrame = {}
  return {
    sender: {
      id: 1,
      mainFrame,
      on: vi.fn(),
      once: vi.fn(),
      isDestroyed: () => false,
      getType: () => 'window'
    },
    senderFrame: mainFrame
  }
}

function invoke(channel: string, args: unknown): void {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`no handler registered for ${channel}`)
  }
  void handler(rendererEvent(), args)
}

/** Missing dispatch must fail rather than pass the gate via undefined clientKind. */
function onlyAdvertisedClient(records: readonly AdvertisedClient[]): AdvertisedClient {
  const client = records[0]
  if (!client) {
    throw new Error('the handler dispatched nothing')
  }
  return client
}

describe('local Agent Hub capability admission', () => {
  beforeEach(() => {
    handlers.clear()
    advertised.requests.length = 0
    advertised.unary.length = 0
    advertised.streaming.length = 0
    setTrustedUIRendererWebContentsId(1)
  })

  it.each([
    [true, 1, true],
    [false, 1, false],
    [true, 2, false]
  ])(
    'admits a Hub consumer only with the experiment and trusted renderer (enabled=%s, trusted=%s)',
    (enabled, trustedId, admitted) => {
      setTrustedUIRendererWebContentsId(trustedId)
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: mocked dispatch uses only the experiment getter and sender cleanup; every other runtime access would fail.
      registerRuntimeHandlers({
        cleanupSubscriptionsForConnection: vi.fn(),
        isAgentHubEnabled: () => enabled
      } as never)
      invoke('runtime:subscribe', {
        subscriptionId: 'hub',
        method: 'runtime.clientEvents.subscribe',
        params: { agentHub: true }
      })
      invoke('runtime:call', { method: 'agentHub.respond', params: {} })
      for (const client of [
        onlyAdvertisedClient(advertised.unary),
        onlyAdvertisedClient(advertised.streaming)
      ]) {
        expect(client.clientCapabilities?.includes(AGENT_HUB_REQUESTS_CAPABILITY)).toBe(admitted)
        expect(client.clientCapabilities?.includes(AGENT_HUB_GATES_CAPABILITY)).toBe(admitted)
        expect(agentHubDesktopId(client) !== null).toBe(admitted)
      }
    }
  )

  it('keeps ordinary client-event subscriptions from claiming to consume Hub requests', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: mocked dispatch uses only the experiment getter and sender cleanup.
    registerRuntimeHandlers({
      cleanupSubscriptionsForConnection: vi.fn(),
      isAgentHubEnabled: () => true
    } as never)
    invoke('runtime:subscribe', {
      subscriptionId: 'ordinary',
      method: 'runtime.clientEvents.subscribe'
    })
    expect(agentHubDesktopId(onlyAdvertisedClient(advertised.streaming))).toBeNull()
  })
  it('preserves a desktop gate answer mutation envelope across local IPC', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: mocked dispatch only reads capability admission and sender cleanup from this runtime.
    registerRuntimeHandlers({
      cleanupSubscriptionsForConnection: vi.fn(),
      isAgentHubEnabled: () => true
    } as never)
    const envelope = { orchestrationContractVersion: 1, orchestrationRequestId: 'gate-answer' }
    invoke('runtime:call', {
      method: 'orchestration.gateResolveByUser',
      params: { id: 'gate_one', resolution: 'yes' },
      envelope
    })
    expect(advertised.requests[0]).toMatchObject({
      method: 'orchestration.gateResolveByUser',
      ...envelope
    })
  })
})
