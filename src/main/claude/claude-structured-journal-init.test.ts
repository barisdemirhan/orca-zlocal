import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentJournalItemBody } from '../../shared/agent-session/journal/agent-session-journal-types'
import { createClaudeJournalTranslator } from './structured/journal/claude-structured-journal-translation'
import { claudeRecord } from './structured/journal/claude-structured-item-translation'

function capturedInit(): Record<string, unknown> {
  const lines = readFileSync(
    join(__dirname, '__fixtures__', 'claude-adapter-capture-fold.jsonl'),
    'utf8'
  )
    .trim()
    .split('\n')
  for (const line of lines) {
    const entry = claudeRecord(JSON.parse(line))
    const frame = claudeRecord(entry?.frame)
    if (frame?.type === 'system' && frame.subtype === 'init') {
      return frame
    }
  }
  throw new Error('Captured init frame missing')
}

function journal() {
  const items: AgentJournalItemBody[] = []
  const translator = createClaudeJournalTranslator({
    sink: {
      appendItem: (_identity, body) => items.push(body),
      appendTombstone: vi.fn(),
      publish: vi.fn()
    }
  })
  return {
    items,
    handle: (frame: Record<string, unknown>) =>
      translator.handle({
        type: 'message',
        sessionId: 'test-session',
        message: frame
      })
  }
}

describe('Claude init journal boundary', () => {
  it('keeps startup inventory off the transcript while preserving the real quota failure', () => {
    const { items, handle } = journal()
    handle({ ...capturedInit(), mcp_servers: [{ name: 'unavailable-tool', status: 'failed' }] })
    expect(items).toEqual([])

    const quota = "You've hit your weekly limit · resets Oct 17 at 8am (Europe/Istanbul)"
    handle({ type: 'result', subtype: 'success', is_error: true, result: quota })
    expect(items).toContainEqual(
      expect.objectContaining({
        kind: 'status',
        failure: expect.objectContaining({
          kind: 'usageLimitReached',
          detail: expect.objectContaining({ text: quota })
        })
      })
    )
  })
})
