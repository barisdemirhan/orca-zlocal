// @vitest-environment happy-dom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentSessionModelCatalogResult } from '../../../../shared/agent-session/agent-session-wire'
import { resetHostModelCatalogSnapshotsForTests } from '@/runtime/native-chat/model-catalogs/host-model-catalog-snapshots'
import { useAgentHubOrbOptions } from './use-agent-hub-orb-options'

const mocks = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@/runtime/native-chat/requests/structured-agent-session-call', () => ({
  callStructuredAgentSession: mocks.call
}))
vi.mock('@/runtime/hosts/capabilities/local-runtime-capabilities', () => ({
  ensureLocalRuntimeCapabilities: async () => ['agent-session.model-catalog.saved-only.v1']
}))
vi.mock('@/runtime/native-chat/agent-catalogs/host-structured-agents', () => ({
  subscribeHostStructuredAgents: () => () => {},
  readHostStructuredAgentsForRuntime: () => undefined,
  loadHostStructuredAgents: async () => {}
}))

beforeEach(() => {
  resetHostModelCatalogSnapshotsForTests()
  mocks.call.mockReset()
})
afterEach(cleanup)

it('shows only the host account’s Codex models after its listing finishes', async () => {
  let answer!: (catalog: AgentSessionModelCatalogResult) => void
  mocks.call.mockReturnValue(new Promise((resolve) => (answer = resolve)))
  const { result } = renderHook(() => useAgentHubOrbOptions('codex'))

  expect(result.current.models).toEqual([])
  await waitFor(() => expect(mocks.call).toHaveBeenCalled())
  answer({
    origin: 'probe',
    fetchedAt: 1,
    models: [{ id: 'account-model', label: 'Account model', isDefault: true, efforts: [] }]
  })
  await waitFor(() =>
    expect(result.current.models.map((model) => model.id)).toEqual(['account-model'])
  )
})

it.each(['unknown', 'failure'] as const)(
  'keeps unsupported seed IDs out of an %s Codex catalog',
  async (kind) => {
    if (kind === 'failure') {
      mocks.call.mockRejectedValue(new Error('host unavailable'))
    } else {
      mocks.call.mockResolvedValue({ origin: 'unknown' })
    }
    const { result } = renderHook(() => useAgentHubOrbOptions('codex'))

    await waitFor(() => expect(mocks.call).toHaveBeenCalled())
    expect(result.current.models).toEqual([])
  }
)
