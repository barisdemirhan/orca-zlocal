import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AgentHubOrbSessionManager,
  createAgentHubOrbSessionManager
} from './agent-hub-orb-session-manager'
import { hostTestState } from '../../native-chat/agent-session-wire/structured-agent-session-host-test-harness'
import {
  HOST_TEST_NOW,
  HOST_TEST_THREAD
} from '../../native-chat/agent-session-wire/structured-agent-session-host-test-data'
import { setStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-registry'
import { openTestAgentSessionRecordStore } from '../../runtime/agent-session-record-store-test-harness'
import { createGlobalSettingsFixture } from '../../../shared/global-settings-test-fixture'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../shared/agent-session-journal-types'
import { AGENT_HUB_ORB_OPENING_PROMPT } from '../../../shared/agent-hub-orb'
import {
  structuredAgentSessionSendBody,
  structuredAgentSessionMessageSendMutation
} from '../../../shared/structured-agent-session-send-mutation'
import { createStructuredAgentSessionOperationId } from '../../../shared/structured-agent-session-mutation'
import { randomUUID } from 'node:crypto'

let state: ReturnType<typeof hostTestState>
let settings: ReturnType<typeof createGlobalSettingsFixture>
let manager: AgentHubOrbSessionManager
let runtime: ConstructorParameters<typeof AgentHubOrbSessionManager>[0]

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(HOST_TEST_NOW)
  state = hostTestState()
  setStructuredAgentSessionHost(state.host)
  settings = createGlobalSettingsFixture({
    experimentalAgentHub: true,
    agentHubOrbAgent: 'codex',
    agentHubOrbModel: null,
    agentHubOrbCwd: state.root
  })
  runtime = {
    isAgentHubEnabled: () =>
      settings.experimentalAgentHub === true && settings.agentHubAgentControl !== false,
    ensureStructuredAgentSessionHost: async () => {},
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
      accountHome: { variable: 'CODEX_HOME', path: state.root },
      runtimeKind: 'native',
      hostLaunchDirectory: params.hostLaunchDirectory ?? join(state.root, 'floating'),
      options: { model: 'global-model' }
    })),
    publishStructuredAgentSessionTab: async (params) => {
      await state.host.setSessionTabVisibility(params.sessionId, true)
    }
  }
  manager = createAgentHubOrbSessionManager(runtime, {
    getSettings: () => settings,
    updateSettings: (updates) => {
      settings = { ...settings, ...updates }
    }
  })
})
afterEach(async () => {
  for (const record of state.store.listRecords()) {
    await state.host.close(record.sessionId, 'user-close')
  }
  setStructuredAgentSessionHost(null)
  vi.restoreAllMocks()
})

describe('Orb conversations on the structured host', () => {
  it('requires a chosen folder, rejects missing and file paths, and persists an explicit cwd', async () => {
    settings.agentHubOrbCwd = null
    settings.floatingTerminalCwd = state.root
    await expect(manager.open()).rejects.toMatchObject({
      code: 'invalid_argument',
      message: 'Orb folder is not chosen'
    })
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
  })
  it('coalesces concurrent opens, commits one opening instruction, and persists the floating location and tag', async () => {
    const [first, second] = await Promise.all([
      manager.open(),
      manager.open({ model: 'another-model' })
    ])
    expect(second).toEqual(first)
    expect(manager.current()).toEqual(first)
    const records = state.store.listRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      sessionId: first.sessionId,
      origin: 'agent-hub-orb',
      location: { workspaceId: FLOATING_TERMINAL_WORKTREE_ID, workspaceKind: 'folder' },
      launchDirectory: state.root,
      options: {}
    })
    const snapshot = await state.host.journalSnapshot(first.sessionId)
    expect(snapshot.submissions).toHaveLength(1)
    expect(JSON.stringify(snapshot.items)).toContain(AGENT_HUB_ORB_OPENING_PROMPT)
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
    vi.spyOn(state.host, 'send').mockRejectedValueOnce(new Error('disk failure'))
    await expect(manager.open()).rejects.toMatchObject({ code: 'invalid_argument' })
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
    expect(state.store.listRecords()).toHaveLength(0)
  })
})
