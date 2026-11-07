import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AgentHubOrbSessionManager,
  createAgentHubOrbSessionManager
} from './agent-hub-orb-session-manager'
import { hostTestState } from '../../native-chat/agent-session-wire/host/testing/structured-agent-session-host-test-harness'
import {
  HOST_TEST_NOW,
  HOST_TEST_THREAD
} from '../../native-chat/agent-session-wire/host/testing/structured-agent-session-host-test-data'
import { setStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { openTestAgentSessionRecordStore } from '../../runtime/agent-session/records/agent-session-record-store-test-harness'
import { createGlobalSettingsFixture } from '../../../shared/global-settings-test-fixture'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../shared/agent-session/journal/agent-session-journal-types'
import { AGENT_HUB_ORB_OPENING_PROMPT } from '../../../shared/agent-hub-orb'
import {
  AGENT_HUB_ORB_INSTRUCTION_FILES,
  agentHubOrbInstructionsMarkdown,
  ensureAgentHubOrbDirectory
} from './agent-hub-orb-directory'
import {
  structuredAgentSessionSendBody,
  structuredAgentSessionMessageSendMutation
} from '../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import { createStructuredAgentSessionOperationId } from '../../../shared/agent-session/lifecycle/structured-agent-session-mutation'
import { randomUUID } from 'node:crypto'
import { claudeProviderHandle } from '../../../shared/agent-session/lifecycle/agent-session-provider-handle-encoding'
import {
  committedMobileSessionTabClose,
  refusedMobileSessionTabClose
} from '../../runtime/session-lifecycle/close/mobile-session-tab-close-outcome'
import { AgentModelCatalogStore } from '../../native-chat/agent-model-catalog/agent-model-catalog-store'
import { createAgentModelCatalogService } from '../../native-chat/agent-model-catalog/agent-model-catalog-service'
import type { AgentModelCatalogProbe } from '../../native-chat/agent-model-catalog/agent-model-catalog-store'
import {
  AgentHubOrbOperations,
  registerOrbOperations
} from '../../runtime/agent-hub/agent-hub-orb-operations'

let state: ReturnType<typeof hostTestState>
let orbDirectory: string
let settings: ReturnType<typeof createGlobalSettingsFixture>
let manager: AgentHubOrbSessionManager
let runtime: ConstructorParameters<typeof AgentHubOrbSessionManager>[0]
let notifySettings: () => void

function serveCodexModels(probe: AgentModelCatalogProbe): void {
  state.host.deps.modelCatalog = createAgentModelCatalogService({
    store: new AgentModelCatalogStore(),
    getRecord: (sessionId) => state.store.getRecord(sessionId) ?? undefined,
    getConversation: (sessionId) => state.store.getConversation(sessionId) ?? undefined,
    drivesRecord: () => true,
    resolveAccountHome: async () => ({ variable: 'CODEX_HOME', path: state.root }),
    workspaceMayOverrideDefaultModel: async () => false,
    probes: { codex: probe }
  })
}

it('refuses Pi Ask before reserving a session or starting a provider', async () => {
  settings.agentHubOrbAgent = 'pi'
  settings.agentHubOrbPermission = 'ask'
  await expect(manager.open()).rejects.toMatchObject({
    code: 'invalid_argument',
    message: 'Pi requires Full access. Choose another agent to ask before running commands.'
  })
  expect(state.store.listRecords()).toHaveLength(0)
  expect(state.acquire).not.toHaveBeenCalled()
})

beforeEach(async () => {
  notifySettings = () => {}
  vi.spyOn(Date, 'now').mockReturnValue(HOST_TEST_NOW)
  state = hostTestState()
  orbDirectory = await ensureAgentHubOrbDirectory(join(state.root, 'orb'))
  setStructuredAgentSessionHost(state.host)
  settings = createGlobalSettingsFixture({
    experimentalAgentHub: true,
    agentHubOrbAgent: 'codex',
    agentHubOrbModel: null,
    agentHubOrbCwd: null,
    floatingTerminalCwd: state.root
  })
  serveCodexModels(async () => ({
    models: [
      'default-model',
      'kept-model',
      'first-model',
      'model-2',
      'chosen-model',
      'orb-model',
      'previous-model'
    ].map((id, index) => ({
      id,
      label: id,
      isDefault: index === 0,
      efforts: []
    })),
    fastModeTierByModel: new Map(),
    origin: 'probe'
  }))
  runtime = {
    agentHub: { snapshot: () => ({ requests: [], progress: [] }) },
    isAgentHubEnabled: () =>
      settings.experimentalAgentHub === true && settings.agentHubAgentControl !== false,
    ensureStructuredAgentSessionHost: async () => {},
    getAgentProviderSessionRows: () => [],
    getStructuredAgentCliSourceRoute: () => 'unsupported',
    resolveStructuredAgentSessionLocalWorkspacePath: async () => null,
    resolveStructuredAgentSessionCreateIntent: vi.fn<
      ConstructorParameters<
        typeof AgentHubOrbSessionManager
      >[0]['resolveStructuredAgentSessionCreateIntent']
    >(async (params) => ({
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
      hostLaunchDirectory:
        params.hostLaunchDirectory ?? (settings.floatingTerminalCwd || state.root),
      options: { model: 'global-model' }
    })),
    publishStructuredAgentSessionTab: async (params) => {
      await state.host.setSessionTabVisibility(params.sessionId, true)
    },
    closeMobileSessionTab: vi.fn(async (_worktree, tabId) => {
      const record = state.store
        .listRecords()
        .find((entry) => `agent-session:${entry.sessionId}` === tabId)
      if (!record) {
        throw new Error('No visible session')
      }
      await state.host.setSessionTabVisibility(record.sessionId, false)
      await state.host.close(record.sessionId, 'user-close')
      return committedMobileSessionTabClose(
        { forgetTabs: () => {} },
        FLOATING_TERMINAL_WORKTREE_ID,
        [tabId]
      )
    })
  }
  manager = createAgentHubOrbSessionManager(
    runtime,
    {
      getSettings: () => settings,
      updateSettings: (updates) => {
        settings = { ...settings, ...updates }
      },
      onSettingsChanged: (listener) => {
        notifySettings = () => listener({}, settings)
        return () => {}
      }
    },
    () => ensureAgentHubOrbDirectory(join(state.root, 'orb'))
  )
})
afterEach(async () => {
  for (const record of state.store.listRecords()) {
    await state.host.close(record.sessionId, 'user-close')
  }
  setStructuredAgentSessionHost(null)
  vi.restoreAllMocks()
})

describe('Orb conversations on the structured host', () => {
  it('refuses an unavailable saved model without silently selecting or saving another model', async () => {
    settings.agentHubOrbModel = 'gpt-6.1-sol'
    serveCodexModels(async () => ({
      models: [
        { id: 'first-supported', label: 'First supported', isDefault: false, efforts: [] },
        { id: 'supported-model', label: 'Supported', isDefault: true, efforts: [] }
      ],
      fastModeTierByModel: new Map(),
      origin: 'probe'
    }))

    await expect(manager.open()).rejects.toThrow('selected Codex model is unavailable')
    expect(state.acquire).not.toHaveBeenCalled()
    expect(state.store.listRecords()).toHaveLength(0)
    expect(settings.agentHubOrbModel).toBe('gpt-6.1-sol')
  })

  it.each(['failed', 'missing'] as const)(
    'uses provider defaults without reading or pinning a model when the catalog is %s',
    async (kind) => {
      const probe = vi.fn(async () => {
        throw new Error('offline')
      })
      serveCodexModels(probe)
      if (kind === 'missing') {
        delete state.host.deps.modelCatalog
      }
      const first = await manager.open()
      expect(state.store.getRecord(first.sessionId)?.options).toBeUndefined()
      expect(state.acquire.mock.calls[0]?.[0].options?.model).toBeUndefined()
      expect(settings.agentHubOrbModel).toBeNull()
      expect(probe).not.toHaveBeenCalled()
      expect(await manager.open()).toEqual(first)
    }
  )

  it.each(['empty', 'failed', 'unavailable', 'missing'] as const)(
    'does not create a Codex conversation or rewrite its saved model when the catalog is %s',
    async (kind) => {
      settings.agentHubOrbModel = 'kept-unverified-model'
      serveCodexModels(async () => {
        if (kind === 'failed') {
          throw new Error('catalog request failed')
        }
        return {
          models:
            kind === 'empty' ? [] : [{ id: 'model', label: 'Model', isDefault: true, efforts: [] }],
          fastModeTierByModel: new Map(),
          origin: 'probe',
          ...(kind === 'unavailable' ? { unavailable: { reason: 'notSignedIn' as const } } : {})
        }
      })
      if (kind === 'missing') {
        delete state.host.deps.modelCatalog
      }

      await expect(manager.open()).rejects.toThrow('Codex models could not be verified')
      expect(state.store.listRecords()).toHaveLength(0)
      expect(state.acquire).not.toHaveBeenCalled()
      expect(settings.agentHubOrbModel).toBe('kept-unverified-model')
    }
  )

  it('closes through the existing tab path and preserves history, with an idle close doing nothing', async () => {
    await manager.close()
    expect(runtime.closeMobileSessionTab).not.toHaveBeenCalled()
    const first = await manager.open({ model: 'kept-model' })
    await manager.close()
    expect(runtime.closeMobileSessionTab).toHaveBeenCalledWith(
      `id:${FLOATING_TERMINAL_WORKTREE_ID}`,
      `agent-session:${first.sessionId}`,
      { reason: 'user' }
    )
    expect(manager.current()).toBeNull()
    expect(await manager.list()).toMatchObject([
      { sessionId: first.sessionId, agent: 'codex', model: 'kept-model' }
    ])
    await manager.close()
    expect(runtime.closeMobileSessionTab).toHaveBeenCalledTimes(1)
  })

  it('switches to a past conversation and keeps exactly one tab even for concurrent resumes', async () => {
    const acquire = state.acquire.getMockImplementation()
    if (!acquire) {
      throw new Error('Expected host acquisition fixture')
    }
    state.acquire.mockImplementation(async (input) => {
      const acquired = await acquire(input)
      return input.identity.agent === 'claude' && acquired.link
        ? {
            ...acquired,
            link: { ...acquired.link, handle: claudeProviderHandle('claude-orb-thread', null) }
          }
        : acquired
    })
    const first = await manager.open({ model: 'first-model' })
    await manager.close()
    const second = await manager.open({ agent: 'claude', model: 'second-model' })
    const [resumedFirst, resumedSecond] = await Promise.all([
      manager.open({ resume: { sessionId: first.sessionId } }),
      manager.open({ resume: { sessionId: second.sessionId } })
    ])
    expect(resumedFirst).toMatchObject({ sessionId: first.sessionId, resumed: true })
    expect(resumedSecond).toMatchObject({ sessionId: second.sessionId, resumed: true })
    expect(manager.current()?.sessionId).toBe(second.sessionId)
    expect(
      state.store.listRecords().filter((entry) => state.host.getSessionTabId(entry.sessionId))
    ).toHaveLength(1)
    expect(await manager.open({ resume: { sessionId: second.sessionId } })).toEqual(resumedSecond)
    expect(await manager.open()).toEqual(resumedSecond)
    expect(state.store.listRecords()).toHaveLength(2)
    expect(state.store.getRecord(first.sessionId)?.options?.model).toBe('first-model')
    expect(state.store.getRecord(second.sessionId)?.provider).toBe('claude')
  })

  it('leaves the active conversation intact for an invalid resume or refused close', async () => {
    const previous = await manager.open()
    await manager.close()
    const active = await manager.open()
    await expect(manager.open({ resume: { sessionId: 'missing' } })).rejects.toMatchObject({
      code: 'not_found'
    })
    expect(manager.current()?.sessionId).toBe(active.sessionId)
    vi.mocked(runtime.closeMobileSessionTab).mockResolvedValueOnce(
      refusedMobileSessionTabClose('stale-publication')
    )
    await expect(manager.open({ resume: { sessionId: previous.sessionId } })).rejects.toMatchObject(
      { code: 'invalid_argument' }
    )
    expect(manager.current()?.sessionId).toBe(active.sessionId)
    expect(state.host.getSessionTabId(previous.sessionId)).toBeNull()
  })

  it('keeps operation protection on a refused close and releases it after a verified Orb close', async () => {
    const current = await manager.open()
    const operations = new AgentHubOrbOperations(vi.fn())
    registerOrbOperations(runtime, operations)
    const done = Promise.withResolvers<void>()
    const target = { kind: 'session', sessionId: 'target-chat' } as const
    const pending = operations.run(
      current.sessionId,
      target,
      'agentSession.send',
      async () => done.promise
    )
    try {
      vi.mocked(runtime.closeMobileSessionTab).mockResolvedValueOnce(
        refusedMobileSessionTabClose('stale-publication')
      )
      await expect(manager.close()).rejects.toMatchObject({ code: 'invalid_argument' })
      expect(operations.canWrite(target)).toBe(false)
      await manager.close()
      expect(operations.canWrite(target)).toBe(true)
      expect(operations.snapshot()).toEqual([])
    } finally {
      done.resolve()
      await pending
      operations.dispose()
    }
  })

  it('serializes an opening, close, and next opening instead of returning the conversation being closed', async () => {
    const firstOpening = manager.open()
    const closing = manager.close()
    const nextOpening = manager.open()
    const first = await firstOpening
    await closing
    const next = await nextOpening
    expect(next.sessionId).not.toBe(first.sessionId)
    expect(manager.current()?.sessionId).toBe(next.sessionId)
    expect(
      state.store.listRecords().filter((entry) => state.host.getSessionTabId(entry.sessionId))
    ).toHaveLength(1)
  })

  it('keeps the active conversation visible and refuses a switch when the provider close has not settled', async () => {
    const previous = await manager.open()
    await manager.close()
    const active = await manager.open()
    state.host.deps.adapter.closeSession = vi.fn(async () => true).mockResolvedValueOnce(false)
    await expect(manager.open({ resume: { sessionId: previous.sessionId } })).rejects.toThrow(
      'provider-child'
    )
    expect(manager.current()?.sessionId).toBe(active.sessionId)
    expect(state.host.getSessionTabId(active.sessionId)).toBe(active.tabId)
    expect(state.host.getSessionTabId(previous.sessionId)).toBeNull()
  })

  it('limits history by record activity before reading journals and keeps provider defaults unpinned', async () => {
    vi.mocked(Date.now).mockReturnValue(HOST_TEST_NOW + 10_000)
    const first = await manager.open()
    await manager.close()
    vi.mocked(Date.now).mockReturnValue(HOST_TEST_NOW)
    const second = await manager.open({ model: 'model-2' })
    const read = vi.spyOn(state.host, 'journalSnapshot')
    const entries = await manager.list(1)
    expect(read).toHaveBeenCalledExactlyOnceWith(first.sessionId)
    expect(entries[0].sessionId).toBe(first.sessionId)
    expect(entries[0].model).toBeUndefined()
    expect((await manager.list()).map((entry) => entry.sessionId)).toEqual([
      first.sessionId,
      second.sessionId
    ])
  })
  it('reads long journals without passing every timestamp as a function argument', async () => {
    const current = await manager.open()
    await state.host.send(
      { callerKey: 'desktop' },
      structuredAgentSessionMessageSendMutation({
        sessionId: current.sessionId,
        clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
        expectedRuntimeFence: state.store.getRecord(current.sessionId)?.lease.runtimeFence ?? 1,
        body: structuredAgentSessionSendBody('Long journal', [])
      })
    )
    const snapshot = await state.host.journalSnapshot(current.sessionId)
    const item = snapshot.items[0]
    if (!item) {
      throw new Error('Expected the sent message in the journal')
    }
    vi.spyOn(state.host, 'journalSnapshot').mockResolvedValue({
      ...snapshot,
      items: Array.from({ length: 150_000 }, () => ({ ...item, observedAt: HOST_TEST_NOW + 1 }))
    })
    expect(await manager.list(1)).toMatchObject([
      { sessionId: current.sessionId, lastActiveAt: HOST_TEST_NOW + 1 }
    ])
  })
  it('runs in the Orb folder whatever the saved Orb or floating folders say', async () => {
    settings.agentHubOrbCwd = join(state.root, 'old-orb-folder')
    settings.floatingTerminalCwd = ''
    const opened = await manager.open()
    expect(state.store.getRecord(opened.sessionId)?.launchDirectory).toBe(orbDirectory)
    expect(settings.agentHubOrbCwd).toBe(join(state.root, 'old-orb-folder'))
    await manager.close()
    const nextDirectory = join(state.root, 'floating-next')
    await mkdir(nextDirectory)
    settings.floatingTerminalCwd = nextDirectory
    const next = await manager.open()
    expect(state.store.getRecord(next.sessionId)?.launchDirectory).toBe(orbDirectory)
    const resumed = await manager.open({ resume: { sessionId: opened.sessionId } })
    expect(resumed.sessionId).toBe(opened.sessionId)
    expect(state.store.getRecord(opened.sessionId)?.launchDirectory).toBe(orbDirectory)
  })
  it('rewrites stale instruction files on open instead of sending an opening message', async () => {
    await writeFile(join(orbDirectory, 'CLAUDE.md'), '# edited by hand\n')
    const opened = await manager.open()
    for (const name of AGENT_HUB_ORB_INSTRUCTION_FILES) {
      expect(await readFile(join(orbDirectory, name), 'utf8')).toBe(
        agentHubOrbInstructionsMarkdown()
      )
    }
    expect(agentHubOrbInstructionsMarkdown()).toContain(AGENT_HUB_ORB_OPENING_PROMPT)
    const snapshot = await state.host.journalSnapshot(opened.sessionId)
    expect(snapshot.submissions).toHaveLength(0)
    expect(snapshot.items).toHaveLength(0)
  })
  it('keeps explicit cwd requests compatible and rejects missing and file paths before launch', async () => {
    await expect(manager.open({ cwd: join(state.root, 'missing') })).rejects.toMatchObject({
      code: 'invalid_argument'
    })
    await writeFile(join(state.root, 'not-a-directory'), '')
    await expect(manager.open({ cwd: join(state.root, 'not-a-directory') })).rejects.toMatchObject({
      code: 'invalid_argument'
    })
    expect(state.store.listRecords()).toHaveLength(0)
    expect(settings.agentHubOrbCwd).toBeNull()
    const chosen = join(state.root, 'chosen')
    await mkdir(chosen)
    const opened = await manager.open({ cwd: chosen })
    expect(settings.agentHubOrbCwd).toBe(chosen)
    expect(state.store.getRecord(opened.sessionId)?.launchDirectory).toBe(chosen)
    // Why: outside the Orb folder no instruction file is read, so the prompt is the first message.
    const snapshot = await state.host.journalSnapshot(opened.sessionId)
    expect(snapshot.submissions).toHaveLength(1)
    expect(JSON.stringify(snapshot.items)).toContain(AGENT_HUB_ORB_OPENING_PROMPT)
  })
  it('coalesces concurrent opens, starts silently in the Orb folder, and persists the location and tag', async () => {
    const [first, second] = await Promise.all([manager.open(), manager.open()])
    expect(second).toEqual(first)
    expect(manager.current()).toEqual(first)
    const records = state.store.listRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      sessionId: first.sessionId,
      origin: 'agent-hub-orb',
      location: { workspaceId: FLOATING_TERMINAL_WORKTREE_ID, workspaceKind: 'folder' },
      launchDirectory: orbDirectory,
      permissionMode: 'auto'
    })
    expect(records[0]?.options).toBeUndefined()
    const snapshot = await state.host.journalSnapshot(first.sessionId)
    expect(snapshot.submissions).toHaveLength(0)
    const reopened = await openTestAgentSessionRecordStore(state.root)
    expect(reopened.getRecord(first.sessionId)?.origin).toBe('agent-hub-orb')
    expect(
      new AgentHubOrbSessionManager(
        runtime,
        () => settings,
        () => {}
      ).current()
    ).toMatchObject({
      sessionId: first.sessionId
    })
  })

  it('uses Orb model overrides and takes the first real user message and last reply from the journal', async () => {
    settings.agentHubOrbModel = 'orb-model'
    const first = await manager.open({ model: 'chosen-model' })
    const clientOperationId = createStructuredAgentSessionOperationId(randomUUID)
    const result = await state.host.send(
      { callerKey: 'desktop' },
      structuredAgentSessionMessageSendMutation({
        sessionId: first.sessionId,
        clientOperationId,
        expectedRuntimeFence: state.store.getRecord(first.sessionId)?.lease.runtimeFence ?? 1,
        body: structuredAgentSessionSendBody('Find stuck workers', [])
      })
    )
    expect(result.ok).toBe(true)
    const events = state.acquire.mock.calls.at(-1)?.[0].events
    if (!events) {
      throw new Error('No acquired provider')
    }
    events.appendItem(
      { provider: 'codex', threadId: HOST_TEST_THREAD, turnId: 'turn-1', ordinal: 55 },
      {
        kind: 'message',
        role: 'assistant',
        blocks: [{ type: 'text', text: 'Two workers are waiting.' }]
      },
      { turnScope: AGENT_JOURNAL_THREAD_SCOPE }
    )
    events.appendItem(
      { provider: 'codex', threadId: HOST_TEST_THREAD, turnId: 'turn-1', ordinal: 56 },
      {
        kind: 'approval',
        title: 'Inspect a workspace?',
        detail: null,
        options: [{ id: 'allow', label: 'Allow' }],
        resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
      },
      { turnScope: AGENT_JOURNAL_THREAD_SCOPE, observedAt: HOST_TEST_NOW + 20_000 }
    )
    await state.host.flushStreamedEvents(first.sessionId)
    expect(await manager.list()).toMatchObject([
      {
        sessionId: first.sessionId,
        model: 'chosen-model',
        title: 'Find stuck workers',
        lastReply: 'Two workers are waiting.',
        lastActiveAt: HOST_TEST_NOW + 20_000
      }
    ])
    await state.host.setSessionTabVisibility(first.sessionId, false)
    await state.host.close(first.sessionId, 'user-close')
    expect(manager.current()).toBeNull()
    const next = await manager.open()
    expect(state.store.getRecord(next.sessionId)?.options?.model).toBe('orb-model')
    expect(await manager.list(1)).toHaveLength(1)
  })

  it('reveals the same tagged closed conversation without a new record or opening turn', async () => {
    const previous = await manager.open({ model: 'previous-model' })
    await state.host.send(
      { callerKey: 'desktop' },
      structuredAgentSessionMessageSendMutation({
        sessionId: previous.sessionId,
        clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
        expectedRuntimeFence: state.store.getRecord(previous.sessionId)?.lease.runtimeFence ?? 1,
        body: structuredAgentSessionSendBody('Earlier Orb question', [])
      })
    )
    const before = await state.host.journalSnapshot(previous.sessionId)
    await state.host.setSessionTabVisibility(previous.sessionId, false)
    await state.host.close(previous.sessionId, 'user-close')
    const resumed = await manager.open({ resume: { sessionId: previous.sessionId } })
    expect(resumed.sessionId).toBe(previous.sessionId)
    expect(resumed.resumed).toBe(true)
    expect(state.store.listRecords()).toHaveLength(1)
    expect(state.store.getRecord(resumed.sessionId)).toMatchObject({
      origin: 'agent-hub-orb',
      options: { model: 'previous-model' }
    })
    const snapshot = await state.host.journalSnapshot(resumed.sessionId)
    expect(JSON.stringify(snapshot.items)).toContain('Earlier Orb question')
    expect(snapshot.submissions).toHaveLength(before.submissions.length)
    expect(manager.current()).toEqual(resumed)
  })

  it('keeps a committed session current after a prompt failure so retry cannot create another chat', async () => {
    const chosen = join(state.root, 'chosen')
    await mkdir(chosen)
    vi.spyOn(state.host, 'send').mockRejectedValueOnce(new Error('disk failure'))
    await expect(manager.open({ cwd: chosen })).rejects.toMatchObject({
      code: 'invalid_argument'
    })
    expect(state.store.listRecords()).toHaveLength(1)
    await expect(manager.open()).resolves.toMatchObject({
      sessionId: state.store.listRecords()[0].sessionId
    })
    const snapshot = await state.host.journalSnapshot(state.store.listRecords()[0].sessionId)
    expect(snapshot.submissions).toHaveLength(1)
    expect(JSON.stringify(snapshot.items)).toContain(AGENT_HUB_ORB_OPENING_PROMPT)
  })

  it('rejects untagged and unknown resume sources before creating a session', async () => {
    await expect(manager.open({ resume: { sessionId: 'not_an_orb' } })).rejects.toMatchObject({
      code: 'not_found'
    })
    expect(state.store.listRecords()).toHaveLength(0)
  })

  it.each(['experiment', 'control'])('refuses all entry points with %s off', async (gate) => {
    if (gate === 'experiment') {
      settings.experimentalAgentHub = false
    } else {
      settings.agentHubAgentControl = false
    }
    expect(() => manager.current()).toThrow(expect.objectContaining({ code: 'disabled' }))
    expect(() => manager.open()).toThrow(expect.objectContaining({ code: 'disabled' }))
    await expect(manager.list()).rejects.toMatchObject({ code: 'disabled' })
    await expect(manager.close()).resolves.toBeUndefined()
    expect(state.store.listRecords()).toHaveLength(0)
  })

  it.each(['experiment', 'control'] as const)(
    'stops the host Orb when %s is disabled without requiring a panel reopen',
    async (gate) => {
      const current = await manager.open()
      if (gate === 'experiment') {
        settings.experimentalAgentHub = false
      } else {
        settings.agentHubAgentControl = false
      }
      notifySettings()
      await vi.waitFor(() => expect(state.host.getSessionTabId(current.sessionId)).toBeNull())
      expect(runtime.closeMobileSessionTab).toHaveBeenCalledOnce()
      await expect(manager.close()).resolves.toBeUndefined()
    }
  )

  it('stops an Act freely turn when Ask is saved while the renderer panel is closed', async () => {
    settings.agentHubOrbPermission = 'free'
    notifySettings()
    state.dispatch.mockResolvedValueOnce({ state: 'admitted' })
    const current = await manager.open()
    const close = vi.fn(async () => true)
    state.host.deps.adapter.closeSession = close
    settings.agentHubOrbPermission = 'ask'
    notifySettings()
    await vi.waitFor(() => expect(close).toHaveBeenCalled())
    await vi.waitFor(() => expect(state.host.getSessionTabId(current.sessionId)).toBeNull())
    const next = await manager.open()
    expect(next.sessionId).not.toBe(current.sessionId)
    expect(settings.agentHubOrbPermission).toBe('ask')
  })

  it('restarts a resumed chat under the saved approvals and stops it when they narrow later', async () => {
    const previous = await manager.open()
    expect(state.store.getRecord(previous.sessionId)?.permissionMode).toBe('auto')
    await manager.close()
    settings.agentHubOrbPermission = 'free'
    notifySettings()
    const resumed = await manager.open({ resume: { sessionId: previous.sessionId } })
    expect(resumed.sessionId).toBe(previous.sessionId)
    expect(state.store.getRecord(previous.sessionId)?.permissionMode).toBe('full-access')
    expect(state.host.getSessionTabId(previous.sessionId)).not.toBeNull()
    settings.agentHubOrbPermission = 'ask'
    notifySettings()
    await vi.waitFor(() => expect(state.host.getSessionTabId(previous.sessionId)).toBeNull())
  })

  it('keeps a chat that never had a choice open when Full access is chosen later', async () => {
    delete settings.agentHubOrbPermission
    const current = await manager.open()
    settings.agentHubOrbPermission = 'free'
    notifySettings()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(state.host.getSessionTabId(current.sessionId)).not.toBeNull()
  })

  it('republishes a committed Orb after an unconfirmed tab publication without attaching twice', async () => {
    const attach = vi.spyOn(state.host, 'attach')
    vi.spyOn(runtime, 'publishStructuredAgentSessionTab').mockRejectedValueOnce(
      new Error('window timeout')
    )
    const current = await manager.open()
    expect(attach).toHaveBeenCalledOnce()
    expect(state.store.listRecords()).toHaveLength(1)
    expect(state.host.getSessionTabId(current.sessionId)).toBe(current.tabId)
    expect((await state.host.journalSnapshot(current.sessionId)).submissions).toHaveLength(0)
  })
})
