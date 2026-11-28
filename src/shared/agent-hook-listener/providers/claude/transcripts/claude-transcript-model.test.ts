import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readClaudeLeadEventModel } from './claude-transcript-model'

const dirs: string[] = []
function transcript(...records: object[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'claude-model-'))
  dirs.push(dir)
  const path = join(dir, 'session.jsonl')
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`)
  return path
}

afterEach(() => {
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }))
})

describe('readClaudeLeadEventModel', () => {
  it('reads a mid-session model switch from the lead transcript at Stop', () => {
    const path = transcript(
      { type: 'assistant', message: { model: 'claude-fable-5-2' } },
      { type: 'user', message: { content: '/model' } },
      { type: 'assistant', message: { model: 'claude-opus-5-5' } },
      { type: 'assistant', isSidechain: true, message: { model: 'claude-haiku-5-5' } },
      { type: 'assistant', message: { model: '<synthetic>' } }
    )
    expect(readClaudeLeadEventModel('Stop', { transcript_path: path })).toBe('claude-opus-5-5')
    expect(readClaudeLeadEventModel('PreToolUse', { transcript_path: path })).toBeUndefined()
    expect(
      readClaudeLeadEventModel('Stop', { transcript_path: path, model: 'claude-sonnet-5-5' })
    ).toBe('claude-sonnet-5-5')
  })
})
