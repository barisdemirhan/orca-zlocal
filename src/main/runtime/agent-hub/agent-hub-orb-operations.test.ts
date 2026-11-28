import { afterEach, expect, it, vi } from 'vitest'
import { AgentHubOrbOperations } from './agent-hub-orb-operations'
import { RuntimeTerminalWriter } from '../terminal/input/runtime-terminal-writer'
import { WRITE_ACCEPTED } from '../../../shared/terminal/pty/lifecycle/pty-write-settlement'
import { TERMINAL_INPUT_CHUNK_MAX_BYTES } from '../../../shared/terminal/input/terminal-input'
import { AgentHubEventSchema } from '../../../shared/rpc-contract/agent-hub-events'
import type { AgentHubProgress } from '../../../shared/agent-hub-requests'

afterEach(() => vi.useRealTimers())
const target = { kind: 'terminal', ptyId: 'pty', paneKey: 'pane', terminalHandle: 'term' } as const

it('protects only the active target and releases on completion or failure using the existing progress envelope', async () => {
  const events: AgentHubProgress[] = []
  const operations = new AgentHubOrbOperations((event) => events.push(event), 0)
  const done = Promise.withResolvers<void>()
  const pending = operations.run('orb', target, 'terminal.send', async () => done.promise)
  expect(operations.canWrite(target)).toBe(false)
  expect(operations.canWrite({ ...target, ptyId: 'another-pty' })).toBe(true)
  expect(AgentHubEventSchema.parse(events[0]).kind).toBe('progress')
  expect(AgentHubEventSchema.parse(events[0])).toMatchObject({
    orbOperation: { active: true, target }
  })
  done.resolve()
  await pending
  expect(operations.canWrite(target)).toBe(true)
  expect(events.at(-1)).toMatchObject({ text: null, orbOperation: { active: false } })
  await expect(
    operations.run('orb', target, 'terminal.send', async () => {
      throw new Error('provider failed')
    })
  ).rejects.toThrow('provider failed')
  expect(operations.snapshot()).toEqual([])
})

it('stops a real chunked terminal write before any next chunk or Enter after the user takes control', async () => {
  vi.useFakeTimers()
  const operations = new AgentHubOrbOperations(vi.fn())
  const firstWrite = Promise.withResolvers<typeof WRITE_ACCEPTED>()
  const bytes: string[] = []
  const writer = new RuntimeTerminalWriter(
    vi.fn(),
    () => 'linux',
    () => null,
    (_ptyId, data) => {
      bytes.push(data)
      return bytes.length === 1 ? firstWrite.promise : WRITE_ACCEPTED
    }
  )
  const text = 'x'.repeat(TERMINAL_INPUT_CHUNK_MAX_BYTES + 1)
  const pending = operations.run('orb', target, 'terminal.send', async (signal) =>
    writer.writeAction('pty', { text, enter: true }, `${text}\r`, {
      inputKind: 'driving',
      requireWriteSettlement: true,
      signal,
      beforeWrite: () => operations.assertWritable(target)
    })
  )
  const settled = expect(pending).resolves.toMatchObject({
    outcome: 'unverifiable',
    bytesHandedToTransport: true
  })
  await vi.advanceTimersByTimeAsync(2_000)
  expect(bytes).toHaveLength(1)
  const id = operations.snapshot()[0]!.orbOperation!.id
  expect(operations.release(id)).toBe(true)
  firstWrite.resolve(WRITE_ACCEPTED)
  await vi.advanceTimersByTimeAsync(2_000)
  await settled
  expect(bytes).toHaveLength(1)
  expect(bytes.join('')).not.toContain('\r')
})

it('keeps a newer operation protected when the cancelled operation finally returns', async () => {
  const operations = new AgentHubOrbOperations(vi.fn(), 0)
  const oldDone = Promise.withResolvers<void>()
  const old = operations.run('orb', target, 'terminal.send', async () => {
    await oldDone.promise
    operations.assertWritable(target)
  })
  const oldRejected = expect(old).rejects.toThrow('orb_operation_cancelled')
  const oldId = operations.snapshot()[0]!.requestId
  operations.release(oldId)
  const newDone = Promise.withResolvers<void>()
  const fresh = operations.run('orb', target, 'terminal.send', async () => newDone.promise)
  oldDone.resolve()
  await oldRejected
  expect(operations.snapshot()).toHaveLength(1)
  expect(operations.canWrite(target)).toBe(false)
  expect(operations.release(oldId)).toBe(false)
  newDone.resolve()
  await fresh
  expect(operations.canWrite(target)).toBe(true)
})

it('expires orphan protection without confusing native sessions with terminal panes', async () => {
  vi.useFakeTimers()
  const operations = new AgentHubOrbOperations(vi.fn())
  const done = Promise.withResolvers<void>()
  const pending = operations.run(
    'orb',
    { kind: 'session', sessionId: 'chat' },
    'agentSession.send',
    async () => done.promise
  )
  expect(operations.canWrite(target)).toBe(true)
  expect(operations.canWrite({ kind: 'session', sessionId: 'chat' })).toBe(false)
  await vi.advanceTimersByTimeAsync(120_001)
  expect(operations.snapshot()).toEqual([])
  done.resolve()
  await pending
})

it("holds the lease between an Orb turn's writes and releases it after the idle grace", async () => {
  vi.useFakeTimers()
  const events: AgentHubProgress[] = []
  const operations = new AgentHubOrbOperations((event) => events.push(event))
  await operations.run('orb', target, 'terminal.send', async () => 'text')
  expect(operations.canWrite(target)).toBe(false)
  expect(() => operations.assertWritable(target, 'another-orb')).toThrow('orb_target_busy')
  await vi.advanceTimersByTimeAsync(1_000)
  const [lease] = operations.snapshot()
  await operations.run('orb', target, 'terminal.send', async () => 'enter')
  expect(operations.snapshot()).toHaveLength(1)
  expect(operations.snapshot()[0]!.requestId).toBe(lease!.requestId)
  await vi.advanceTimersByTimeAsync(1_000)
  expect(operations.canWrite(target)).toBe(false)
  await vi.advanceTimersByTimeAsync(1_000)
  expect(operations.canWrite(target)).toBe(true)
  expect(events.at(-1)).toMatchObject({ text: null, orbOperation: { active: false } })
})

it('lets the user take control during the idle grace', async () => {
  vi.useFakeTimers()
  const operations = new AgentHubOrbOperations(vi.fn())
  await operations.run('orb', target, 'terminal.send', async () => 'text')
  expect(operations.release(operations.snapshot()[0]!.requestId)).toBe(true)
  expect(operations.canWrite(target)).toBe(true)
})
