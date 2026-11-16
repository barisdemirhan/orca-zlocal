import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AgentHubOrbSessionManager } from './agent-hub-orb-session-manager'
import { readTestHostJournal } from '../../native-chat/agent-session-journal/journal-observation.test-support'
import { hostTestState } from '../../native-chat/agent-session-wire/host/testing/structured-agent-session-host.test-fixture'
import { setStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { createGlobalSettingsFixture } from '../../../shared/global-settings-test-fixture'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { claudeProviderHandle } from '../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import {
  HOST_TEST_NOW,
  HOST_TEST_THREAD
} from '../../native-chat/agent-session-wire/host/testing/structured-agent-session-host-test-data.test-fixture'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../shared/agent-session/journal/agent-session-journal-types'
import { createAgentModelCatalogService } from '../../native-chat/agent-model-catalog/agent-model-catalog-service'
import { AgentModelCatalogStore } from '../../native-chat/agent-model-catalog/agent-model-catalog-store'

let state: ReturnType<typeof hostTestState>
let settings: ReturnType<typeof createGlobalSettingsFixture>
let manager: AgentHubOrbSessionManager
let runtime: OrcaRuntimeService
let runtimeForOrb: ConstructorParameters<typeof AgentHubOrbSessionManager>[0]

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(HOST_TEST_NOW)
  state = hostTestState()
  setStructuredAgentSessionHost(state.host)
  settings = createGlobalSettingsFixture({ agentHubOrbAgent: 'codex', agentHubOrbModel: null })
  state.host.deps.modelCatalog = createAgentModelCatalogService({
    store: new AgentModelCatalogStore(),
    getRecord: (sessionId) => state.store.getRecord(sessionId) ?? undefined,
    getConversation: (sessionId) => state.store.getConversation(sessionId) ?? undefined,
    drivesRecord: () => true,
    resolveAccountHome: async () => ({ variable: 'CODEX_HOME', path: state.root }),
    workspaceMayOverrideDefaultModel: async () => false,
    probes: {
      codex: async () => ({
        models: ['default-model', 'explicit-model', 'new-model'].map((id, index) => ({
          id,
          label: id,
          isDefault: index === 0,
          efforts: []
        })),
        fastModeTierByModel: new Map(),
        origin: 'probe'
      })
    }
  })
  runtime = new OrcaRuntimeService({
    getRepo: () => undefined,
    getRepos: () => [],
    getAllWorktreeMeta: () => ({}),
    getWorktreeMeta: () => undefined,
    getSettings: () => settings
  } as unknown as ConstructorParameters<typeof OrcaRuntimeService>[0])
  const acquire = state.acquire.getMockImplementation()
  if (!acquire) {
    throw new Error('Missing provider acquisition fixture')
  }
  state.acquire.mockImplementation(async (input) => {
    const acquired = await acquire(input)
    return input.identity.agent === 'claude' && acquired.link
      ? {
          ...acquired,
          link: { ...acquired.link, handle: claudeProviderHandle('orb-thread', null) }
        }
      : acquired
  })
  runtimeForOrb = {
    agentHub: runtime.agentHub,
    isAgentHubEnabled: () => true,
    ensureStructuredAgentSessionHost: async () => {},
    getAgentProviderSessionRows: () => [],
    getStructuredAgentCliSourceRoute: () => 'unsupported',
    resolveStructuredAgentSessionLocalWorkspacePath: async () => null,
    resolveStructuredAgentSessionCreateIntent: async (params) => ({
      envelope: { ...params.envelope, expectedRuntimeFence: null, payloadFingerprint: '' },
      location: {
        executionHostId: 'local',
        wslDistro: null,
        workspaceId: FLOATING_TERMINAL_WORKTREE_ID,
        workspaceKind: 'folder'
      },
      provider: params.agent,
      agent: params.agent,
      accountHome: {
        variable: params.agent === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME',
        path: state.root
      },
      runtimeKind: 'native',
      hostLaunchDirectory: state.root
    }),
    publishStructuredAgentSessionTab: (input) => runtime.publishStructuredAgentSessionTab(input),
    closeMobileSessionTab: (...args) => runtime.closeMobileSessionTab(...args)
  }
  manager = new AgentHubOrbSessionManager(
    runtimeForOrb,
    () => settings,
    () => {}
  )
})

afterEach(async () => {
  state.host.deps.adapter.closeSession = async () => true
  for (const record of state.store.listRecords()) {
    await state.host.close(record.sessionId, 'user-close')
  }
  runtime.agentHub.dispose()
  setStructuredAgentSessionHost(null)
  vi.restoreAllMocks()
})

async function settle(sessionId: string): Promise<void> {
  const snapshot = await readTestHostJournal(state.host, sessionId)
  for (const submission of snapshot.submissions) {
    await state.host.waitForSendSettlement(sessionId, submission.clientMessageId)
  }
  const events = state.acquire.mock.calls.findLast(
    ([input]) => input.identity.sessionId === sessionId
  )?.[0].events
  if (!events) {
    throw new Error('Missing acquired provider')
  }
  events.appendItem(
    { provider: 'codex', threadId: HOST_TEST_THREAD, turnId: 'turn-1', ordinal: 100 },
    {
      kind: 'turn',
      turnId: 'turn-1',
      state: 'completed',
      startedAt: HOST_TEST_NOW,
      completedAt: HOST_TEST_NOW + 1
    },
    { turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
  await state.host.flushStreamedEvents(sessionId)
}

it('closes a floating conversation through the runtime and keeps its history available', async () => {
  const first = await manager.open()
  await manager.close()
  expect(manager.current()).toBeNull()
  expect((await runtime.listMobileSessionTabs(`id:${FLOATING_TERMINAL_WORKTREE_ID}`)).tabs).toEqual(
    []
  )
  expect(await manager.list()).toMatchObject([{ sessionId: first.sessionId }])
})

it.each(['agent', 'model'] as const)(
  'applies changed %s settings to an idle conversation and retains history',
  async (setting) => {
    const first = await manager.open({ model: 'explicit-model' })
    await settle(first.sessionId)
    expect((await manager.open()).sessionId).toBe(first.sessionId)
    if (setting === 'agent') {
      settings.agentHubOrbAgent = 'claude'
    } else {
      settings.agentHubOrbModel = 'new-model'
    }
    const next = await manager.open()
    expect(next.sessionId).not.toBe(first.sessionId)
    expect(state.store.getRecord(next.sessionId)).toMatchObject({
      provider: setting === 'agent' ? 'claude' : 'codex',
      permissionMode: 'auto',
      ...(setting === 'agent' ? {} : { options: { model: 'new-model' } })
    })
    if (setting === 'agent') {
      expect(state.store.getRecord(next.sessionId)?.options).toBeUndefined()
    }
    expect((await manager.list()).map((entry) => entry.sessionId)).toContain(first.sessionId)
    expect(state.host.getSessionTabId(first.sessionId)).toBeNull()
  }
)

it.each(['agent', 'model'] as const)(
  'checks the persisted %s against settings before this manager first opens Orb',
  async (selection) => {
    const first = await manager.open()
    await settle(first.sessionId)
    manager = new AgentHubOrbSessionManager(
      runtimeForOrb,
      () => settings,
      () => {}
    )
    if (selection === 'agent') {
      settings.agentHubOrbAgent = 'claude'
    } else {
      settings.agentHubOrbModel = 'new-model'
    }
    const next = await manager.open()
    expect(next.sessionId).not.toBe(first.sessionId)
    expect(state.store.getRecord(next.sessionId)).toMatchObject({
      provider: selection === 'agent' ? 'claude' : 'codex',
      permissionMode: 'auto',
      ...(selection === 'agent' ? {} : { options: { model: 'new-model' } })
    })
    if (selection === 'agent') {
      expect(state.store.getRecord(next.sessionId)?.options).toBeUndefined()
    }
    expect(state.host.getSessionTabId(first.sessionId)).toBeNull()
  }
)

it.each(['reveal', 'publication'] as const)(
  'restores the original conversation if a history resume fails during %s',
  async (failure) => {
    const previous = await manager.open()
    await manager.close()
    const current = await manager.open()
    if (failure === 'reveal') {
      vi.spyOn(state.host, 'revealSession').mockRejectedValueOnce(new Error('reveal failed'))
    } else {
      vi.spyOn(runtimeForOrb, 'publishStructuredAgentSessionTab').mockRejectedValueOnce(
        new Error('publication failed')
      )
    }
    await expect(manager.open({ resume: { sessionId: previous.sessionId } })).rejects.toThrow(
      `${failure} failed`
    )
    expect(manager.current()?.sessionId).toBe(current.sessionId)
    expect(state.host.getSessionTabId(current.sessionId)).toBe(current.tabId)
    expect(state.host.getSessionTabId(previous.sessionId)).toBeNull()
  }
)

it('restores the original conversation if committing a settings replacement fails', async () => {
  const current = await manager.open()
  await settle(current.sessionId)
  settings.agentHubOrbModel = 'new-model'
  vi.spyOn(state.host, 'attach').mockRejectedValueOnce(new Error('attach failed'))
  await expect(manager.open()).rejects.toThrow('attach failed')
  expect(manager.current()?.sessionId).toBe(current.sessionId)
  expect(state.host.getSessionTabId(current.sessionId)).toBe(current.tabId)
  expect(state.store.listRecords()).toHaveLength(1)
})

it.each(['running', 'approval'] as const)(
  'refuses a settings transition with %s work without closing the current conversation',
  async (kind) => {
    const current = await manager.open()
    const events = state.acquire.mock.calls.at(-1)?.[0].events
    if (!events) {
      throw new Error('Missing acquired provider')
    }
    events.appendItem(
      { provider: 'codex', threadId: HOST_TEST_THREAD, turnId: 'turn-1', ordinal: 99 },
      kind === 'running'
        ? {
            kind: 'turn',
            turnId: 'turn-1',
            state: 'running',
            startedAt: HOST_TEST_NOW,
            requestedAt: HOST_TEST_NOW
          }
        : {
            kind: 'approval',
            title: 'Run command?',
            detail: null,
            options: [{ id: 'allow', label: 'Allow' }],
            resolution: {
              state: 'pending',
              selectedOptionId: null,
              resolvedBy: null,
              resolvedAt: null
            }
          },
      { turnScope: AGENT_JOURNAL_THREAD_SCOPE }
    )
    await state.host.flushStreamedEvents(current.sessionId)
    settings.agentHubOrbAgent = 'claude'
    await expect(manager.open()).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(manager.current()?.sessionId).toBe(current.sessionId)
    expect(state.store.listRecords()).toHaveLength(1)
  }
)

it.each([
  ['ask', 'free'],
  ['free', 'ask']
] as const)(
  'restarts an idle provider when Orb permission changes from %s to %s',
  async (before, after) => {
    settings.agentHubOrbPermission = before
    const current = await manager.open()
    await settle(current.sessionId)
    settings.agentHubOrbPermission = after
    const next = await manager.open()
    expect(next.sessionId).not.toBe(current.sessionId)
    expect(state.host.getSessionTabId(current.sessionId)).toBeNull()
    expect((await manager.list()).map((entry) => entry.sessionId)).toContain(current.sessionId)
  }
)

it('keeps the current conversation when permission changes while its opening send is pending', async () => {
  state.dispatch.mockResolvedValueOnce({ state: 'admitted' })
  settings.agentHubOrbPermission = 'free'
  const current = await manager.open()
  settings.agentHubOrbPermission = 'ask'
  await expect(manager.open()).rejects.toMatchObject({ code: 'invalid_argument' })
  expect(manager.current()?.sessionId).toBe(current.sessionId)
  expect(state.store.listRecords()).toHaveLength(1)
})

it('preserves an idle conversation while its Orb question is unanswered', async () => {
  const current = await manager.open()
  await settle(current.sessionId)
  runtime.agentHub.registerDesktop('desktop')
  const caller = {
    kind: 'orb' as const,
    sessionId: current.sessionId,
    paneKey: '',
    terminalHandle: ''
  }
  const answer = runtime.agentHub.ask(
    caller,
    caller,
    {
      question: 'Proceed?',
      options: ['Yes', 'No'],
      multi: false
    },
    60_000,
    'orb-question'
  )
  settings.agentHubOrbAgent = 'claude'
  try {
    await expect(manager.open()).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(manager.current()?.sessionId).toBe(current.sessionId)
  } finally {
    runtime.agentHub.respond('orb-question', { kind: 'ask', answer: 'No', index: 2 }, 'desktop')
    await answer
  }
})

it('restores the original tab if the provider cannot prove it stopped during a settings change', async () => {
  const current = await manager.open()
  await settle(current.sessionId)
  state.host.deps.adapter.closeSession = vi.fn(async () => true).mockResolvedValueOnce(false)
  settings.agentHubOrbAgent = 'claude'
  await expect(manager.open()).rejects.toThrow('provider-child')
  expect(manager.current()?.sessionId).toBe(current.sessionId)
  expect(state.host.getSessionTabId(current.sessionId)).toBe(current.tabId)
  expect(
    (await runtime.listMobileSessionTabs(`id:${FLOATING_TERMINAL_WORKTREE_ID}`)).tabs
  ).toMatchObject([{ sessionId: current.sessionId }])
  expect(state.store.listRecords()).toHaveLength(1)
})

it.each(['launch', 'catalog'] as const)(
  'keeps the current conversation visible if the selected provider cannot prepare its %s',
  async (failure) => {
    const current = await manager.open()
    await settle(current.sessionId)
    if (failure === 'launch') {
      vi.spyOn(runtimeForOrb, 'resolveStructuredAgentSessionCreateIntent').mockRejectedValueOnce(
        new Error('selected provider unavailable')
      )
      settings.agentHubOrbAgent = 'claude'
    } else {
      state.host.deps.modelCatalog = createAgentModelCatalogService({
        store: new AgentModelCatalogStore(),
        getRecord: (sessionId) => state.store.getRecord(sessionId) ?? undefined,
        getConversation: (sessionId) => state.store.getConversation(sessionId) ?? undefined,
        drivesRecord: () => true,
        resolveAccountHome: async () => ({ variable: 'CODEX_HOME', path: state.root }),
        probes: {
          codex: async () => {
            throw new Error('catalog unavailable')
          }
        }
      })
      settings.agentHubOrbModel = 'new-model'
    }
    await expect(manager.open()).rejects.toThrow(
      failure === 'launch' ? 'selected provider unavailable' : 'Codex models could not be verified'
    )
    expect(manager.current()?.sessionId).toBe(current.sessionId)
    expect(state.host.getSessionTabId(current.sessionId)).toBe(current.tabId)
    expect(state.store.listRecords()).toHaveLength(1)
  }
)

it('refuses changed settings while the previous agent is opening instead of returning its session as applied', async () => {
  state.dispatch.mockResolvedValueOnce({ state: 'admitted' })
  let started!: () => void
  let release!: () => void
  const acquiring = new Promise<void>((resolve) => {
    started = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const acquire = state.acquire.getMockImplementation()
  if (!acquire) {
    throw new Error('Missing provider acquisition fixture')
  }
  state.acquire.mockImplementationOnce(async (input) => {
    started()
    await released
    return acquire(input)
  })
  const firstOpening = manager.open()
  await acquiring
  settings.agentHubOrbAgent = 'claude'
  const nextOpening = manager.open()
  const refused = expect(nextOpening).rejects.toMatchObject({ code: 'invalid_argument' })
  release()
  const first = await firstOpening
  await refused
  expect(state.store.getRecord(first.sessionId)?.provider).toBe('codex')
  expect(manager.current()?.sessionId).toBe(first.sessionId)
  expect(state.store.listRecords()).toHaveLength(1)
})
