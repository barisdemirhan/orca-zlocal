/** @vitest-environment happy-dom */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import type { RuntimeStatus } from '../../../../shared/runtime-types'
import type {
  AgentHubDelivery,
  AgentHubRendererApi,
  AgentHubRequest
} from '../../../../shared/agent-hub-requests'
import { AGENT_HUB_REQUESTS_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import { useAgentHubRequestConsumer } from './use-agent-hub-request-consumer'
import { readAgentHubRequests } from './agent-hub-requests-store'
import { buildAgentHubLists } from './agent-hub-lists'
import { agentHubRequestBase } from './agent-hub-request-test-fixtures'

const clients = vi.hoisted(
  () =>
    new Map<
      string,
      {
        receive?: (delivery: AgentHubDelivery) => void
        stop: ReturnType<typeof vi.fn<() => void>>
        respond: ReturnType<typeof vi.fn<AgentHubRendererApi['respond']>>
      }
    >()
)
vi.mock('@/runtime/agent-hub-client', () => ({
  createAgentHubClient: (environmentId: string | null): AgentHubRendererApi => {
    const client: {
      stop: ReturnType<typeof vi.fn<() => void>>
      respond: ReturnType<typeof vi.fn<AgentHubRendererApi['respond']>>
      receive?: (delivery: AgentHubDelivery) => void
    } = {
      stop: vi.fn<() => void>(),
      respond: vi.fn<AgentHubRendererApi['respond']>(async (requestId) => ({
        accepted: true as const,
        requestId
      })),
      receive: undefined
    }
    clients.set(environmentId ?? 'local', client)
    return {
      subscribe: (handler) => {
        client.receive = handler
        return client.stop
      },
      respond: client.respond
    }
  }
}))
vi.mock('./agent-hub-request-executor', () => ({
  executeAgentHubRequest: vi.fn(async (_host: string, request: AgentHubRequest) =>
    ['ask', 'consent', 'notify'].includes(request.kind) ? null : { kind: 'ack' }
  )
}))
const initial = useAppStore.getState()
const status = (capabilities: string[]): RuntimeStatus => ({
  runtimeId: 'runtime-workhost',
  rendererGraphEpoch: 1,
  graphStatus: 'ready',
  authoritativeWindowId: 1,
  liveTabCount: 0,
  liveLeafCount: 0,
  capabilities
})
const environment = (id: string) => ({
  id,
  name: id,
  createdAt: 1,
  updatedAt: 1,
  pairingRevision: 1,
  lastUsedAt: null,
  runtimeId: null,
  preferredEndpointId: 'ws',
  endpoints: [{ id: 'ws', kind: 'websocket' as const, label: 'ws', endpoint: 'ws://127.0.0.1' }]
})
function Harness(): null {
  useAgentHubRequestConsumer([], buildAgentHubLists([]))
  return null
}
beforeEach(() => {
  clients.clear()
  useAppStore.setState({
    settings: createGlobalSettingsFixture({ experimentalAgentHub: true }),
    runtimeEnvironments: [environment('workhost'), environment('old')],
    runtimeStatusByEnvironmentId: new Map([
      [
        'workhost',
        { status: status([AGENT_HUB_REQUESTS_CAPABILITY]), checkedAt: 1, connectionGeneration: 1 }
      ],
      ['old', { status: status([]), checkedAt: 1 }]
    ])
  })
})
afterEach(() => {
  cleanup()
  useAppStore.setState(initial)
  vi.clearAllMocks()
})

it('consumes local and every capable paired host, fences old generations and withdraws on disable', async () => {
  render(<Harness />)
  expect([...clients.keys()]).toEqual(['local', 'workhost'])
  const local = clients.get('local')
  const remote = clients.get('workhost')
  act(() => useAppStore.setState({ statusBarVisible: false }))
  expect(remote?.stop).not.toHaveBeenCalled()
  expect(local?.stop).not.toHaveBeenCalled()
  const base = agentHubRequestBase()
  const ask = { ...base, kind: 'ask' as const, question: 'Go?', options: ['Yes'], multi: false }
  act(() => {
    local?.receive?.({ kind: 'snapshot', snapshot: { requests: [ask], progress: [] } })
    remote?.receive?.(ask)
  })
  expect(readAgentHubRequests().get('local')?.pendingAsks.size).toBe(1)
  expect(readAgentHubRequests().get('workhost')?.pendingAsks.size).toBe(1)
  await act(async () => {
    await Promise.resolve()
  })
  expect(local?.respond).not.toHaveBeenCalled()
  expect(remote?.respond).not.toHaveBeenCalled()
  act(() =>
    useAppStore.setState({
      runtimeStatusByEnvironmentId: new Map([
        [
          'workhost',
          { status: status([AGENT_HUB_REQUESTS_CAPABILITY]), checkedAt: 2, connectionGeneration: 2 }
        ]
      ])
    })
  )
  expect(remote?.stop).toHaveBeenCalledOnce()
  remote?.receive?.(ask)
  expect(readAgentHubRequests().has('workhost')).toBe(false)
  const next = clients.get('workhost')
  act(() => next?.receive?.({ ...base, kind: 'status' }))
  await act(async () => {
    await Promise.resolve()
  })
  expect(next?.respond).toHaveBeenCalledWith(base.requestId, { kind: 'ack' })
  act(() =>
    useAppStore.setState({
      settings: createGlobalSettingsFixture({
        experimentalAgentHub: true,
        agentHubAgentControl: false
      })
    })
  )
  expect(local?.stop).toHaveBeenCalledOnce()
  expect(next?.stop).toHaveBeenCalledOnce()
  expect(readAgentHubRequests().size).toBe(0)
  act(() =>
    useAppStore.setState({ settings: createGlobalSettingsFixture({ experimentalAgentHub: true }) })
  )
  expect(clients.get('local')).not.toBe(local)
})

it('consumes every connected capable environment independently of the selected host', () => {
  const current = useAppStore.getState()
  useAppStore.setState({
    runtimeEnvironments: [...current.runtimeEnvironments, environment('other')],
    runtimeStatusByEnvironmentId: new Map([
      ...current.runtimeStatusByEnvironmentId,
      ['other', { status: status([AGENT_HUB_REQUESTS_CAPABILITY]), checkedAt: 1 }]
    ])
  })
  render(<Harness />)
  expect([...clients.keys()]).toEqual(['local', 'workhost', 'other'])
  const base = agentHubRequestBase()
  act(() => {
    clients.get('workhost')?.receive?.({ ...base, kind: 'progress', text: 'First host' })
    clients.get('other')?.receive?.({ ...base, kind: 'progress', text: 'Second host' })
  })
  expect(readAgentHubRequests().get('workhost')?.progressByPane.get(base.target.paneKey)?.text).toBe(
    'First host'
  )
  expect(readAgentHubRequests().get('other')?.progressByPane.get(base.target.paneKey)?.text).toBe(
    'Second host'
  )
  act(() =>
    useAppStore.setState({
      settings: createGlobalSettingsFixture({
        experimentalAgentHub: true,
        agentHubAgentControl: false
      })
    })
  )
  expect(clients.get('workhost')?.stop).toHaveBeenCalledOnce()
  expect(clients.get('other')?.stop).toHaveBeenCalledOnce()
  expect(readAgentHubRequests().size).toBe(0)
})

it('unsubscribes a disconnected pairing, reinstalls on a contact epoch and stays stopped when the experiment is off', () => {
  render(<Harness />)
  const first = clients.get('workhost')
  act(() =>
    useAppStore.setState({
      runtimeStatusByEnvironmentId: new Map([
        [
          'workhost',
          {
            status: status([AGENT_HUB_REQUESTS_CAPABILITY]),
            checkedAt: 2,
            connectionGeneration: 1,
            hostContactEpoch: 1
          }
        ]
      ])
    })
  )
  expect(first?.stop).toHaveBeenCalledOnce()
  const reconnected = clients.get('workhost')
  act(() =>
    useAppStore.setState({
      runtimeStatusByEnvironmentId: new Map([['workhost', { status: null, checkedAt: 3 }]])
    })
  )
  expect(reconnected?.stop).toHaveBeenCalledOnce()
  act(() =>
    useAppStore.setState({ settings: createGlobalSettingsFixture({ experimentalAgentHub: false }) })
  )
  expect(clients.get('local')?.stop).toHaveBeenCalledOnce()
})
