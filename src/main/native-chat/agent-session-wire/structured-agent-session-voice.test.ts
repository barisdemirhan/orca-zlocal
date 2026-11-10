import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentSessionVoiceEvent,
  AgentSessionVoiceOwner
} from '../../../shared/agent-session-voice'
import {
  agentSessionVoiceStartFields,
  agentSessionVoiceStopFields
} from '../../../shared/agent-session-voice'
import { computeAgentSessionPayloadFingerprint } from '../../../shared/agent-session/lifecycle/agent-session-mutation-envelope'
import { codexProviderHandle } from '../../../shared/agent-session/lifecycle/agent-session-provider-handle-encoding'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../shared/agent-session/journal/agent-session-journal-types'
import { claudeAndCodexAgents } from './providers/testing/structured-agent-session-adapter-router-test-support'
import type { StructuredAgentSessionAdapter } from './providers/structured-agent-session-adapter'
import type { StructuredAgentSessionVoiceAdapter } from './structured-agent-session-voice-adapter'
import {
  HOST_TEST_SESSION as SESSION,
  HOST_TEST_THREAD as THREAD,
  hostTestAttachParams,
  hostTestOperationId
} from './host/testing/structured-agent-session-host-test-data'
import {
  createRestTestRig,
  REST_TEST_CALLER as CALLER,
  sweepOnce,
  type RestTestRig
} from './host/testing/structured-agent-session-rest-test-rig'
import { STRUCTURED_AGENT_SESSION_IDLE_MS as IDLE_MS } from './termination/structured-agent-session-idle-sweep'

const OWNER = { voiceSessionId: 'voice-attempt-1', generation: 1 }
const SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
let rig: RestTestRig
let voiceLive = false
const acquire = vi.fn<StructuredAgentSessionAdapter['acquire']>()
const startVoice = vi.fn<StructuredAgentSessionVoiceAdapter['start']>()
const stopVoice = vi.fn<StructuredAgentSessionVoiceAdapter['stop']>()
const appendVoiceText = vi.fn(async () => true)
const closeSession = vi.fn(async () => true)
const cancelTurn = vi.fn(async () => ({ cancelled: true }))

function envelope(method: string, fields: Record<string, unknown>) {
  return {
    sessionId: SESSION,
    clientOperationId: hostTestOperationId(),
    expectedRuntimeFence: rig.store.getRecord(SESSION)?.lease.runtimeFence ?? 1,
    payloadFingerprint: computeAgentSessionPayloadFingerprint({
      method,
      sessionId: SESSION,
      fields
    })
  }
}

function startParams(owner = OWNER) {
  const fields = { ...owner, sdp: SDP }
  return {
    ...fields,
    envelope: envelope('agentSession.startVoice', agentSessionVoiceStartFields(fields))
  }
}

function stopParams(owner = OWNER) {
  return {
    ...owner,
    envelope: envelope('agentSession.stopVoice', agentSessionVoiceStopFields(owner))
  }
}

function subscribe(callerKey = CALLER.callerKey, owner = OWNER, connectionId?: string) {
  const events: AgentSessionVoiceEvent[] = []
  const dispose = rig.host.voice.subscribe({
    ...owner,
    id: `voice:${callerKey}:${connectionId ?? 'in-process'}`,
    sessionId: SESSION,
    callerKey,
    connectionId,
    emit: (event) => events.push(event)
  })
  return { events, dispose }
}

function publish(
  owner: AgentSessionVoiceOwner = OWNER,
  generation = 'provider-generation',
  fence?: number
) {
  rig.host.voice.publish({
    sessionId: SESSION,
    fence: fence ?? rig.store.getRecord(SESSION)?.lease.runtimeFence ?? 1,
    acquisitionGeneration: generation,
    event: { ...owner, sessionId: SESSION, type: 'sdp', sdp: SDP }
  })
}

beforeEach(async () => {
  voiceLive = false
  appendVoiceText.mockReset().mockResolvedValue(true)
  acquire.mockReset().mockImplementation(async ({ fence, spawnToken }) => ({
    acquisitionGeneration: 'provider-generation',
    process: { hostId: 'local', pid: 4242, processStartTimeMs: 1_700_000_000_000, spawnToken },
    link: {
      linkId: `link-${fence}`,
      handle: codexProviderHandle(THREAD),
      origin: 'created',
      mintedAtFence: fence,
      observedAt: 1_700_000_000_000
    }
  }))
  startVoice.mockReset().mockImplementation(async (owner) => {
    voiceLive = true
    return {
      ok: true,
      value: {
        voiceSessionId: owner.voiceSessionId,
        generation: owner.generation,
        state: 'connecting'
      }
    }
  })
  stopVoice.mockReset().mockImplementation(async (owner) => {
    voiceLive = false
    return { voiceSessionId: owner.voiceSessionId, generation: owner.generation, state: 'off' }
  })
  closeSession.mockClear()
  cancelTurn.mockClear()
  const adapter: StructuredAgentSessionAdapter = {
    acquire,
    open: async () => ({ reportedOptions: { model: '' } }),
    voice: {
      start: startVoice,
      stop: stopVoice,
      appendText: appendVoiceText,
      holds: () => voiceLive,
      capability: async () => ({ supported: true, accountAccess: 'unchecked' })
    },
    closeSession,
    dispatch: async () => ({
      state: 'accepted',
      providerIdentity: { provider: 'codex', threadId: THREAD, turnId: 'turn-1', ordinal: 1 }
    }),
    cancelTurn,
    releaseAcquisition: async () => true,
    answerPrompt: async ({ commit }) => commit(),
    setOption: async () => undefined
  }
  rig = await createRestTestRig({
    adapter,
    agents: claudeAndCodexAgents(adapter),
    idleSweep: { intervalMs: 3_600_000 }
  })
  expect((await rig.host.attach(CALLER, hostTestAttachParams(null))).ok).toBe(true)
})
afterEach(async () => {
  await rig?.dispose()
})

describe('voice at the structured host mutation boundary', () => {
  it('delivers opted-in context only to the exact live caller and never repeats a recorded delivery', async () => {
    subscribe()
    expect((await rig.host.voice.start(CALLER, startParams())).ok).toBe(true)
    const fields = { ...OWNER, text: 'Selected agent has an unanswered decision.' }
    const params = { ...fields, envelope: envelope('agentSession.appendVoiceText', fields) }
    expect(await rig.host.voice.appendText(CALLER, params)).toMatchObject({
      ok: true,
      value: { applied: true }
    })
    await rig.host.voice.appendText(CALLER, params)
    expect(appendVoiceText).toHaveBeenCalledTimes(1)
    const stranger = { ...CALLER, callerKey: 'another-window' }
    expect(
      (
        await rig.host.voice.appendText(stranger, {
          ...fields,
          envelope: envelope('agentSession.appendVoiceText', fields)
        })
      ).ok
    ).toBe(false)
    await rig.host.voice.stop(CALLER, stopParams())
    expect(
      (
        await rig.host.voice.appendText(CALLER, {
          ...fields,
          envelope: envelope('agentSession.appendVoiceText', fields)
        })
      ).ok
    ).toBe(false)
    expect(appendVoiceText).toHaveBeenCalledTimes(1)
    expect(cancelTurn).not.toHaveBeenCalled()
  })
  it('requires a matching signalling subscriber and preserves a pending approval when stopping voice', async () => {
    expect((await rig.host.voice.start(CALLER, startParams())).ok).toBe(false)
    expect(startVoice).not.toHaveBeenCalled()
    const reader = subscribe()
    expect(reader.events).toEqual([{ ...OWNER, sessionId: SESSION, type: 'ready' }])
    const sink = acquire.mock.calls.at(-1)?.[0].events
    if (!sink) {
      throw new Error('Expected the provider event sink')
    }
    sink.appendItem(
      { provider: 'orca', clientMessageId: 'pending-approval' },
      {
        kind: 'approval',
        title: 'Allow the task?',
        detail: null,
        options: [{ id: 'allow', label: 'Allow' }],
        resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
      },
      { turnScope: AGENT_JOURNAL_THREAD_SCOPE }
    )
    await rig.host.flushStreamedEvents(SESSION)
    const start = startParams()
    expect((await rig.host.voice.start(CALLER, start)).ok).toBe(true)
    expect((await rig.host.voice.stop(CALLER, stopParams())).ok).toBe(true)
    expect(cancelTurn).not.toHaveBeenCalled()
    const snapshot = await rig.host.journalSnapshot(SESSION)
    expect(snapshot.submissions).toHaveLength(0)
    expect(snapshot.items.find((item) => item.body.kind === 'approval')?.body).toMatchObject({
      resolution: { state: 'pending' }
    })
    expect(acquire).toHaveBeenCalledTimes(1)
    expect(closeSession).not.toHaveBeenCalled()
    const operation = rig.store.getOperationRow(CALLER.callerKey, start.envelope.clientOperationId)
    expect(operation).toMatchObject({
      fingerprint: start.envelope.payloadFingerprint,
      outcome: { status: 'succeeded' }
    })
    await rig.restart()
    expect(rig.store.getOperationRow(CALLER.callerKey, start.envelope.clientOperationId)).toEqual(
      operation
    )
    expect(JSON.stringify(rig.store.listOperationRows())).not.toContain(SDP)
  })

  it('never replays an ambiguous start, including after the host reopens its durable operation ledger', async () => {
    subscribe()
    startVoice.mockImplementation(async () => {
      voiceLive = true
      throw new Error('Native start outcome is unknown.')
    })
    const params = startParams()
    await expect(rig.host.voice.start(CALLER, params)).rejects.toThrow('outcome is unknown')
    expect((await rig.host.voice.start(CALLER, params)).ok).toBe(false)
    await rig.restart()
    expect((await rig.host.voice.start(CALLER, params)).ok).toBe(false)
    expect(startVoice).toHaveBeenCalledTimes(1)
  })

  it('delivers SDP only to the owning caller and current provider fence, acquisition and voice generation', async () => {
    const intended = subscribe()
    const stranger = subscribe('another-caller')
    const otherWindow = subscribe(CALLER.callerKey, OWNER, 'other-renderer-connection')
    expect((await rig.host.voice.start(CALLER, startParams())).ok).toBe(true)
    publish(OWNER, 'old-provider-generation')
    publish(OWNER, 'provider-generation', 99)
    publish({ ...OWNER, generation: 2 })
    publish({ ...OWNER, voiceSessionId: 'old-attempt' })
    expect(intended.events).toHaveLength(1)
    publish()
    expect(intended.events).toHaveLength(2)
    expect(intended.events[1]).toEqual({ ...OWNER, sessionId: SESSION, type: 'sdp', sdp: SDP })
    expect(stranger.events).toEqual([{ ...OWNER, sessionId: SESSION, type: 'ready' }])
    expect(otherWindow.events).toEqual([{ ...OWNER, sessionId: SESSION, type: 'ready' }])
    expect(
      (
        await rig.host.voice.stop(
          { ...CALLER, connectionId: 'other-renderer-connection' },
          stopParams()
        )
      ).ok
    ).toBe(true)
    expect(stopVoice).not.toHaveBeenCalled()
    expect(voiceLive).toBe(true)
  })

  it('retains an idle provider while voice is active or unconfirmed and stops only that voice when its stream leaves', async () => {
    const ownerCaller = { ...CALLER, connectionId: 'first-document' }
    const reader = subscribe(CALLER.callerKey, OWNER, ownerCaller.connectionId)
    expect((await rig.host.voice.start(ownerCaller, startParams())).ok).toBe(true)
    rig.clock.now += IDLE_MS + 1
    await sweepOnce(rig.host)
    expect(closeSession).not.toHaveBeenCalled()
    stopVoice.mockImplementation(async (owner) => ({
      voiceSessionId: owner.voiceSessionId,
      generation: owner.generation,
      state: 'unverifiable'
    }))
    reader.dispose()
    await vi.waitFor(() => expect(stopVoice).toHaveBeenCalledTimes(1))
    rig.clock.now += IDLE_MS + 1
    await sweepOnce(rig.host)
    expect(closeSession).not.toHaveBeenCalled()
    expect(cancelTurn).not.toHaveBeenCalled()
    const next = { voiceSessionId: 'new-attempt', generation: 2 }
    const reconnected = { ...CALLER, connectionId: 'next-document' }
    subscribe(CALLER.callerKey, next, reconnected.connectionId)
    expect((await rig.host.voice.start(reconnected, startParams(next))).ok).toBe(false)
    expect(startVoice).toHaveBeenCalledTimes(1)
    expect(stopVoice).toHaveBeenCalledTimes(2)
    stopVoice.mockImplementation(async (owner) => {
      voiceLive = false
      return { voiceSessionId: owner.voiceSessionId, generation: owner.generation, state: 'off' }
    })
    expect((await rig.host.voice.start(reconnected, startParams(next))).ok).toBe(true)
    expect(stopVoice).toHaveBeenLastCalledWith(expect.objectContaining(OWNER))
    expect(startVoice).toHaveBeenLastCalledWith(expect.objectContaining(next))
    expect(startVoice).toHaveBeenCalledTimes(2)
    expect(acquire).toHaveBeenCalledTimes(1)
    expect(closeSession).not.toHaveBeenCalled()
    expect(cancelTurn).not.toHaveBeenCalled()
  })

  it('preserves an owned Live connection when another subscribed window tries to replace it', async () => {
    const reader = subscribe()
    expect((await rig.host.voice.start(CALLER, startParams())).ok).toBe(true)
    const next = { voiceSessionId: 'new-attempt', generation: 2 }
    const otherWindow = { ...CALLER, connectionId: 'another-window' }
    const other = subscribe(CALLER.callerKey, next, otherWindow.connectionId)
    expect((await rig.host.voice.start(otherWindow, startParams(next))).ok).toBe(false)
    expect(startVoice).toHaveBeenCalledTimes(1)
    expect(stopVoice).not.toHaveBeenCalled()
    publish()
    expect(reader.events.at(-1)).toEqual({ ...OWNER, sessionId: SESSION, type: 'sdp', sdp: SDP })
    expect(other.events).toEqual([{ ...next, sessionId: SESSION, type: 'ready' }])
  })
})
