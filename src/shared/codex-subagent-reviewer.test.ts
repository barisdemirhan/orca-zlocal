import { appendFileSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import type * as NodeFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveCodexApprovalsReviewer } from './agent-hook-listener/providers/codex/codex-subagent-reviewer'
import type { JsonlCursor } from './agent-hook-listener/providers/codex/codex-rollout-jsonl-format'

const readLengths = vi.hoisted(() => new Array<number>())
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>()
  return {
    ...actual,
    readSync: (
      fd: number,
      buffer: NodeJS.ArrayBufferView,
      offset: number,
      length: number,
      position: number | null
    ) => {
      readLengths.push(length)
      return actual.readSync(fd, buffer, offset, length, position)
    }
  }
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
  vi.clearAllMocks()
  readLengths.length = 0
})

it('recovers the latest reviewer across chunk boundaries and scans only new output on later jumps', () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-reviewer-'))
  roots.push(root)
  const filePath = join(root, 'rollout.jsonl')
  const reviewer = `${JSON.stringify({ type: 'turn_context', payload: { approvals_reviewer: 'auto_review' } })}\n`
  writeFileSync(filePath, reviewer)
  const cursor: JsonlCursor = { filePath, offset: Buffer.byteLength(reviewer), carry: '' }
  expect(
    resolveCodexApprovalsReviewer(
      cursor,
      0,
      [{ type: 'turn_context', payload: { approvals_reviewer: 'auto_review' } }],
      undefined
    )
  ).toBe('auto_review')
  const previousOffset = cursor.offset
  const settings = `${JSON.stringify({
    type: 'event_msg',
    payload: { type: 'thread_settings_applied', thread_settings: { approvals_reviewer: 'user' } }
  })}\n`
  appendFileSync(filePath, settings)
  const output = `${JSON.stringify({ type: 'response_item', payload: { output: 'x'.repeat(300) } })}\n`
  appendFileSync(filePath, output.repeat(6000))
  const scanBytes = statSync(filePath).size - previousOffset
  const padding =
    (64 * 1024 - ((scanBytes - Math.floor(settings.length / 2) + 1) % (64 * 1024))) % (64 * 1024)
  appendFileSync(filePath, `${'x'.repeat(padding)}\n`)
  cursor.offset = statSync(filePath).size
  expect(resolveCodexApprovalsReviewer(cursor, previousOffset, [], 'auto_review')).toBe('user')
  expect(readLengths.length).toBeGreaterThan(1)
  expect(readLengths.every((length) => length <= 64 * 1024)).toBe(true)

  readLengths.length = 0
  expect(resolveCodexApprovalsReviewer(cursor, cursor.offset, [], 'user')).toBe('user')
  expect(readLengths).toEqual([])
  const knownOffset = cursor.offset
  appendFileSync(filePath, output.repeat(6000))
  cursor.offset = statSync(filePath).size
  expect(resolveCodexApprovalsReviewer(cursor, knownOffset, [], 'user')).toBe('user')
  expect(readLengths.reduce((total, length) => total + length, 0)).toBeLessThanOrEqual(
    cursor.offset - knownOffset
  )
})
