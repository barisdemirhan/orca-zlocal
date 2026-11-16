// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import type { AgentSessionVoiceOwner } from '../../../../shared/agent-session-voice'
import type { RuntimeEnvironmentStatus } from '../../../../shared/remote-runtime/host-status/runtime-host-status'
import type { Tab } from '../../../../shared/tab-types'
import { EMPTY_STRUCTURED_AGENT_SESSION } from '../../../../shared/agent-session/structured-agent-session-reducer'
import {
  getRuntimeEnvironmentRevision,
  replaceRuntimeEnvironmentRevisions
} from '@/runtime/rpc/environment-revisions/runtime-environment-revision'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { useStructuredAgentSessionMutate } from '../native-chat/session/structured/writes/use-structured-agent-session-mutate'
import { readAgentHubOrbVoice } from './agent-hub-orb-voice-context'
import { useAgentHubOrbVoice } from './use-agent-hub-orb-voice'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentHubOrbConversation } from './AgentHubOrbConversation'
import { AgentHubOrbComposerContext, useAgentHubOrbComposerBinding } from './agent-hub-orb-composer'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'

type VoiceParams = AgentSessionVoiceOwner & {
  envelope: { sessionId: string; expectedRuntimeFence: number }
}
const mocks = vi.hoisted(() => {
  const state: {
    unifiedTabsByWorktree: Record<string, Tab[]>
    runtimeStatusByEnvironmentId: Map<string, RuntimeEnvironmentStatus>
    settings: {
      activeRuntimeEnvironmentId: string | null
      voice?: { enabled: boolean; sttModel: string }
    }
    dictationState: 'idle'
  } = {
    unifiedTabsByWorktree: {},
    runtimeStatusByEnvironmentId: new Map(),
    settings: { activeRuntimeEnvironmentId: null },
    dictationState: 'idle'
  }
  return {
    state,
    snapshot: vi.fn(),
    unsubscribe: vi.fn(),
    call: vi.fn<
      (
        target: RuntimeClientTarget,
        method: string,
        params?: VoiceParams,
        options?: unknown
      ) => Promise<unknown>
    >()
  }
})
vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
    { getState: () => mocks.state, subscribe: () => () => {} }
  )
}))
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: mocks.call }))
vi.mock('@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability', () => ({
  structuredAgentSessionHostKey: (target: RuntimeClientTarget) =>
    target.kind === 'local' ? 'local' : `environment:${target.environmentId}`,
  useStructuredAgentSessionHostCapabilityState: () => 'supported'
}))
vi.mock('../native-chat/session/structured/read/structured-agent-session-read-owner', () => ({
  getStructuredAgentSessionReadOwner: () => ({
    subscribe: () => () => {},
    getSnapshot: mocks.snapshot
  })
}))
vi.mock('./agent-hub-orb-conversations', () => ({
  useAgentHubOrbConversations: () => ({ conversations: [], error: null, refresh: vi.fn() })
}))

function LaunchConversation() {
  const voice = useAgentHubOrbVoice(session, true)
  return (
    <TooltipProvider>
      <AgentHubOrbConversation
        sessionId="session-a"
        tabId="tab-a"
        state={{ kind: 'idle' }}
        voice={voice}
        visible
        requestPresentationOf={() => ({
          title: 'Orb',
          targetTitle: 'Orb',
          target: null,
          location: { project: 'Orca', group: null, workspace: null }
        })}
      />
    </TooltipProvider>
  )
}
function LaunchComposer({ disabled }: { disabled: boolean }) {
  const input = useRef<HTMLTextAreaElement>(null)
  useAgentHubOrbComposerBinding(input, () => {}, !disabled)
  return <textarea ref={input} disabled={disabled} aria-label="Orb draft" />
}

class Track extends EventTarget {
  enabled = true
  stop = vi.fn()
}
class Stream {
  getTracks = () => [track]
  getAudioTracks = () => [track]
}
class Peer {
  static instances: Peer[] = []
  iceGatheringState = 'complete'
  localDescription: RTCSessionDescriptionInit | null = null
  createDataChannel = () => ({ close: vi.fn() })
  addTrack = vi.fn()
  createOffer = async () => ({ type: 'offer' as const, sdp: 'v=0\r\nm=audio 9 RTP/AVP 111' })
  setLocalDescription = async (description: RTCSessionDescriptionInit) => {
    this.localDescription = description
  }
  close = vi.fn()
  constructor() {
    Peer.instances.push(this)
  }
}
let track: Track
let answerStart: () => void
let sentStart: { target: RuntimeClientTarget; params: VoiceParams }
let closeSubscription: () => void
let failSubscription: () => void
let apiDescriptor: PropertyDescriptor | undefined
const session: AgentHubOrbSession = { sessionId: 'session-a', tabId: 'tab-a', resumed: false }
const targetA: RuntimeClientTarget = { kind: 'environment', environmentId: 'host-a' }

function tab(host: Tab['executionHostId'] = 'local'): Tab {
  return {
    id: 'tab-a',
    entityId: 'session-a',
    groupId: 'group',
    worktreeId: 'workspace',
    contentType: 'agent-session',
    label: 'Orb',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    agentSessionAgent: 'codex',
    executionHostId: host
  }
}
function hostStatus(environmentId: string): RuntimeEnvironmentStatus {
  const status = {
    runtimeId: `${environmentId}-runtime`,
    rendererGraphEpoch: 1,
    graphStatus: 'ready' as const,
    authoritativeWindowId: null,
    liveTabCount: 1,
    liveLeafCount: 0
  }
  return {
    status,
    checkedAt: 1,
    connectionGeneration: 7,
    snapshot: {
      environmentId,
      pairingRevision: 10,
      sequence: 1,
      checkedAt: 1,
      status,
      verification: 'verified',
      transport: 'ready'
    }
  }
}
function subscribe(
  args: { params: AgentSessionVoiceOwner & { sessionId: string } },
  onResponse: (response: unknown) => void
) {
  onResponse({ id: 'voice', ok: true, result: { ...args.params, type: 'ready' } })
  return Promise.resolve({ unsubscribe: mocks.unsubscribe })
}
beforeEach(() => {
  vi.clearAllMocks()
  closeAgentHubOrbPanel()
  track = new Track()
  Peer.instances = []
  mocks.state.unifiedTabsByWorktree = { workspace: [tab()] }
  mocks.state.runtimeStatusByEnvironmentId = new Map([
    ['host-a', hostStatus('host-a')],
    ['host-b', hostStatus('host-b')]
  ])
  mocks.snapshot.mockReturnValue({ state: { ...EMPTY_STRUCTURED_AGENT_SESSION, fence: 3 } })
  replaceRuntimeEnvironmentRevisions([
    { id: 'host-a', createdAt: 1, pairingRevision: 10 },
    { id: 'host-b', createdAt: 1, pairingRevision: 10 }
  ])
  mocks.call.mockImplementation(async (target, method, params) => {
    if (method === 'agentSession.voiceCapability') {
      return { supported: true, accountAccess: 'unchecked' }
    }
    if (!params) {
      throw new Error('Missing voice params')
    }
    if (method === 'agentSession.startVoice') {
      sentStart = { target, params }
      return new Promise((resolve) => {
        answerStart = () =>
          resolve({
            ok: true,
            fence: 4,
            value: {
              voiceSessionId: params.voiceSessionId,
              generation: params.generation,
              state: 'connecting'
            }
          })
      })
    }
    return {
      ok: true,
      fence: 4,
      value: {
        voiceSessionId: params.voiceSessionId,
        generation: params.generation,
        state: 'off'
      }
    }
  })
  vi.stubGlobal('RTCPeerConnection', Peer)
  vi.stubGlobal('MediaStream', Stream)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', {
    userAgent: 'Linux',
    mediaDevices: { getUserMedia: vi.fn(async () => new MediaStream()) },
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object) => Promise<void>
      ) => callback({})
    }
  })
  apiDescriptor = Object.getOwnPropertyDescriptor(window, 'api')
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      agentHub: { orb: { open: vi.fn(async () => session) } },
      runtime: { call: vi.fn(), subscribe },
      runtimeEnvironments: {
        call: vi.fn(),
        subscribe: (
          args: Parameters<typeof subscribe>[0],
          handlers: {
            onResponse: (response: unknown) => void
            onClose: () => void
            onError: (error: { code: string; message: string }) => void
          }
        ) => {
          closeSubscription = handlers.onClose
          failSubscription = () => handlers.onError({ code: 'connection_lost', message: 'Lost' })
          return subscribe(args, handlers.onResponse)
        }
      }
    }
  })
})
afterEach(async () => {
  cleanup()
  closeAgentHubOrbPanel()
  await Promise.resolve()
  if (apiDescriptor) {
    Object.defineProperty(window, 'api', apiDescriptor)
  } else {
    Reflect.deleteProperty(window, 'api')
  }
  vi.unstubAllGlobals()
  replaceRuntimeEnvironmentRevisions([])
})

async function beginVoice(result: { current: ReturnType<typeof useAgentHubOrbVoice> }) {
  await waitFor(() => expect(result.current.capability).toBe('supported'))
  let starting = Promise.resolve()
  act(() => {
    starting = result.current.startLive()
  })
  await waitFor(() =>
    expect(mocks.call.mock.calls.some((call) => call[1] === 'agentSession.startVoice')).toBe(true)
  )
  const controller = readAgentHubOrbVoice('tab-a')
  if (!controller) {
    throw new Error('Voice controller was not registered')
  }
  return { starting, controller }
}
const stops = () => mocks.call.mock.calls.filter((call) => call[1] === 'agentSession.stopVoice')
function expectOldStop(target: RuntimeClientTarget): void {
  expect(stops()).toHaveLength(1)
  expect(stops()[0]).toEqual([
    target,
    'agentSession.stopVoice',
    expect.objectContaining({
      envelope: expect.objectContaining({ sessionId: 'session-a', expectedRuntimeFence: 4 }),
      voiceSessionId: sentStart.params.voiceSessionId,
      generation: sentStart.params.generation
    }),
    ...(target.kind === 'local'
      ? []
      : [
          expect.objectContaining({
            expectedEnvironmentPairingRevision: 10,
            expectedEnvironmentRuntimeId: 'host-a-runtime'
          })
        ])
  ])
}

it('starts Live from the first Orb launch after publication and joins repeated launches', async () => {
  mocks.state.unifiedTabsByWorktree = {
    [FLOATING_TERMINAL_WORKTREE_ID]: [{ ...tab(), worktreeId: FLOATING_TERMINAL_WORKTREE_ID }]
  }
  const { result } = renderHook(() => useAgentHubOrbVoice(session, true))
  await waitFor(() => expect(result.current.capability).toBe('supported'))
  await act(async () => {
    await openAgentHubOrb(undefined, false, 'live')
  })
  await waitFor(() =>
    expect(
      mocks.call.mock.calls.filter((call) => call[1] === 'agentSession.startVoice')
    ).toHaveLength(1)
  )
  await act(async () => {
    await openAgentHubOrb(undefined, false, 'live')
  })
  expect(
    mocks.call.mock.calls.filter((call) => call[1] === 'agentSession.startVoice')
  ).toHaveLength(1)
  const controller = readAgentHubOrbVoice('tab-a')
  if (!controller) {
    throw new Error('Expected launched voice owner')
  }
  await act(async () => {
    answerStart()
    await controller.stopLive()
  })
})

it('does not start a queued Live launch when the user closes Orb during its capability check', async () => {
  mocks.state.unifiedTabsByWorktree = {
    [FLOATING_TERMINAL_WORKTREE_ID]: [{ ...tab(), worktreeId: FLOATING_TERMINAL_WORKTREE_ID }]
  }
  let checked: (() => void) | undefined
  mocks.call.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        checked = () => resolve({ supported: true, accountAccess: 'unchecked' })
      })
  )
  const { result } = renderHook(() => useAgentHubOrbVoice(session, true))
  await waitFor(() => expect(result.current.capability).toBe('checking'))
  await act(async () => {
    await openAgentHubOrb(undefined, false, 'live')
    closeAgentHubOrbPanel()
    checked?.()
  })
  await waitFor(() => expect(result.current.capability).toBe('supported'))
  expect(
    mocks.call.mock.calls.filter((call) => call[1] === 'agentSession.startVoice')
  ).toHaveLength(0)
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
})

it.each(['live', 'dictate'] as const)(
  'keeps a manual Text choice after a queued %s launch becomes ready',
  async (action) => {
    mocks.state.unifiedTabsByWorktree = {
      [FLOATING_TERMINAL_WORKTREE_ID]: [{ ...tab(), worktreeId: FLOATING_TERMINAL_WORKTREE_ID }]
    }
    mocks.state.settings.voice = { enabled: true, sttModel: 'test-model' }
    let finishCheck: (() => void) | undefined
    if (action === 'live') {
      mocks.call.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishCheck = () => resolve({ supported: true, accountAccess: 'unchecked' })
          })
      )
    }
    const actions: unknown[] = []
    const control = (event: Event) => {
      if (event instanceof CustomEvent) {
        actions.push(event.detail)
      }
    }
    document.addEventListener(DICTATION_CONTROL_EVENT, control)
    const view = (disabled: boolean) => (
      <>
        <LaunchConversation />
        <AgentHubOrbComposerContext value="tab-a">
          <LaunchComposer disabled={disabled} />
        </AgentHubOrbComposerContext>
      </>
    )
    try {
      const { rerender } = render(view(true))
      await act(async () => {
        await openAgentHubOrb(undefined, false, action)
      })
      expect(useAgentHubOrbPanel.getState().launchRequest?.action).toBe(action)
      if (action === 'dictate') {
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Minimize Orb' })))
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Expand Orb' })))
      }
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mini window' })))
      await act(async () => {
        finishCheck?.()
        rerender(view(false))
      })
      expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
      expect(
        mocks.call.mock.calls.filter((call) => call[1] === 'agentSession.startVoice')
      ).toHaveLength(0)
      expect(actions).toEqual([])
      expect(useAgentHubOrbPanel.getState().presentation).toBe('mini')
    } finally {
      const owner = readAgentHubOrbVoice('tab-a')
      cleanup()
      finishCheck?.()
      if (mocks.call.mock.calls.some((call) => call[1] === 'agentSession.startVoice')) {
        answerStart()
      }
      await owner?.stopLive()
      document.removeEventListener(DICTATION_CONTROL_EVENT, control)
    }
  }
)

it.each(['hide', 'unmount'] as const)(
  'stops its acquired native voice after %s disables the real hook while start is in flight',
  async (close) => {
    const { result, rerender, unmount } = renderHook<
      ReturnType<typeof useAgentHubOrbVoice>,
      { owner: AgentHubOrbSession | null }
    >(({ owner }) => useAgentHubOrbVoice(owner, owner !== null), {
      initialProps: { owner: session }
    })
    const { starting, controller } = await beginVoice(result)
    if (close === 'hide') {
      rerender({ owner: null })
    } else {
      unmount()
    }
    expect(track.stop).toHaveBeenCalledOnce()
    expect(Peer.instances[0]?.close).toHaveBeenCalledOnce()
    await act(async () => {
      answerStart()
      await starting
      await controller.stopLive()
    })
    expectOldStop({ kind: 'local' })
    expect(controller.getSnapshot().connection).toBe('off')
    await controller.stopLive()
    expect(stops()).toHaveLength(1)
  }
)

it('cleans up host A and its old session after selection moves to B at the same numeric fence', async () => {
  mocks.state.unifiedTabsByWorktree = { workspace: [tab('runtime:host-a')] }
  const { result, rerender } = renderHook(({ owner }) => useAgentHubOrbVoice(owner, true), {
    initialProps: { owner: session }
  })
  const { starting, controller } = await beginVoice(result)
  mocks.state.unifiedTabsByWorktree = { workspace: [tab('runtime:host-b')] }
  rerender({ owner: { ...session, sessionId: 'session-b' } })
  await act(async () => {
    answerStart()
    await starting
    await controller.stopLive()
  })
  expectOldStop(targetA)
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce()
  expect(
    mocks.call.mock.calls.filter((call) => call[1] === 'agentSession.startVoice')
  ).toHaveLength(1)
})

it.each([
  'pairing',
  'connection',
  'disconnected',
  'runtime',
  'stream-close',
  'stream-error'
] as const)(
  'leaves closure unverifiable instead of retargeting when the old host %s changes',
  async (change) => {
    mocks.state.unifiedTabsByWorktree = { workspace: [tab('runtime:host-a')] }
    const { result, rerender } = renderHook<
      ReturnType<typeof useAgentHubOrbVoice>,
      { owner: AgentHubOrbSession | null }
    >(({ owner }) => useAgentHubOrbVoice(owner, owner !== null), {
      initialProps: { owner: session }
    })
    const { starting, controller } = await beginVoice(result)
    rerender({ owner: null })
    const status = hostStatus('host-a')
    if (change === 'pairing') {
      replaceRuntimeEnvironmentRevisions([{ id: 'host-a', createdAt: 1, pairingRevision: 11 }])
      expect(getRuntimeEnvironmentRevision('host-a')).toBe(11)
    } else if (change === 'connection') {
      status.connectionGeneration = 8
    } else if (change === 'disconnected') {
      status.status = null
      if (status.snapshot) {
        status.snapshot.transport = 'disconnected'
      }
    } else if (change === 'stream-close') {
      closeSubscription()
    } else if (change === 'stream-error') {
      failSubscription()
    } else if (status.status) {
      status.status = { ...status.status, runtimeId: 'replacement-runtime' }
    }
    mocks.state.runtimeStatusByEnvironmentId.set('host-a', status)
    await act(async () => {
      answerStart()
      await starting
      await controller.stopLive()
    })
    expect(stops()).toHaveLength(0)
    expect(controller.getSnapshot()).toMatchObject({
      connection: 'error',
      input: 'muted',
      output: 'silent'
    })
    expect(track.stop).toHaveBeenCalledOnce()
  }
)

it('keeps normal mutation writes dropped after the pane is disabled', async () => {
  const stateRef = { current: { fence: 3 } }
  const { result, rerender } = renderHook(
    ({ enabled }) =>
      useStructuredAgentSessionMutate({
        enabled,
        sessionId: 'session-a',
        target: { kind: 'local' },
        stateRef
      }),
    { initialProps: { enabled: true } }
  )
  const oldWrite = result.current.write
  rerender({ enabled: false })
  expect(
    await oldWrite('agentSession.send', 'agentSession.send', { text: 'preserved draft' })
  ).toEqual({ kind: 'dropped' })
  expect(mocks.call).not.toHaveBeenCalled()
})

it.each(['unverifiable', 'transport error'] as const)(
  'retries a native stop after %s without reopening capture or retargeting the host',
  async (failure) => {
    const { result, rerender } = renderHook(() => useAgentHubOrbVoice(session, true))
    const { starting, controller } = await beginVoice(result)
    await act(async () => {
      mocks.snapshot.mockReturnValue({ state: { ...EMPTY_STRUCTURED_AGENT_SESSION, fence: 4 } })
      rerender()
    })
    await act(async () => {
      answerStart()
      await starting
    })
    expect(stops()).toHaveLength(0)
    const original = mocks.call.getMockImplementation()
    let firstStop = true
    mocks.call.mockImplementation(async (target, method, params, options) => {
      if (method === 'agentSession.stopVoice' && firstStop) {
        firstStop = false
        if (failure === 'transport error') {
          throw new Error('stop request timed out')
        }
        return {
          ok: true,
          fence: 4,
          value: {
            voiceSessionId: sentStart.params.voiceSessionId,
            generation: sentStart.params.generation,
            state: 'unverifiable'
          }
        }
      }
      return original?.(target, method, params, options)
    })
    await act(async () => controller.stopLive())
    expect(controller.getSnapshot()).toMatchObject({ connection: 'error', input: 'muted' })
    expectOldStop({ kind: 'local' })
    await act(async () => controller.stopLive())
    expect(controller.getSnapshot().connection).toBe('off')
    expect(stops()).toHaveLength(2)
    expect(stops()[1]).toEqual([
      { kind: 'local' },
      'agentSession.stopVoice',
      expect.objectContaining({
        envelope: expect.objectContaining({ sessionId: 'session-a', expectedRuntimeFence: 4 }),
        voiceSessionId: sentStart.params.voiceSessionId,
        generation: sentStart.params.generation
      })
    ])
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce()
    expect(track.stop).toHaveBeenCalledOnce()
    await act(async () => controller.stopLive())
    expect(stops()).toHaveLength(2)
  }
)
