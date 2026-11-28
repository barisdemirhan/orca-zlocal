import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  appendAgentHubOrbMemory,
  forgetAgentHubOrbMemory,
  readAgentHubOrbMemory
} from './agent-hub-orb-identity-files'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'orb-memory-'))
})
afterEach(() => rm(directory, { recursive: true, force: true }))

describe('Orb memory file', () => {
  it('creates MEMORY.md with a heading and dated entries', async () => {
    await appendAgentHubOrbMemory('Uses pnpm', new Date(2026, 9, 5), directory)
    await appendAgentHubOrbMemory('Prefers  Turkish\n', new Date(2026, 9, 6), directory)
    expect(await readFile(join(directory, 'MEMORY.md'), 'utf8')).toBe(
      '# Memory\n\n- [2026-10-05] Uses pnpm\n- [2026-10-06] Prefers Turkish\n'
    )
    expect(await readAgentHubOrbMemory(directory)).toEqual([
      { line: '- [2026-10-05] Uses pnpm', text: 'Uses pnpm', date: '2026-10-05' },
      { line: '- [2026-10-06] Prefers Turkish', text: 'Prefers Turkish', date: '2026-10-06' }
    ])
  })

  it('keeps hand-written lines verbatim and reports no date for them', async () => {
    await writeFile(join(directory, 'MEMORY.md'), '# Memory\n\nNotes I wrote\n- plain line\n')
    expect(await readAgentHubOrbMemory(directory)).toEqual([
      { line: '- plain line', text: 'plain line', date: null }
    ])
    await appendAgentHubOrbMemory('New', new Date(2026, 0, 2), directory)
    const content = await readFile(join(directory, 'MEMORY.md'), 'utf8')
    expect(content).toBe('# Memory\n\nNotes I wrote\n- plain line\n- [2026-01-02] New\n')
  })

  it('forgets one line or all entries and leaves other text alone', async () => {
    await appendAgentHubOrbMemory('A', new Date(2026, 0, 1), directory)
    await appendAgentHubOrbMemory('B', new Date(2026, 0, 2), directory)
    await forgetAgentHubOrbMemory('- [2026-01-01] A', directory)
    expect((await readAgentHubOrbMemory(directory)).map((e) => e.text)).toEqual(['B'])
    await forgetAgentHubOrbMemory(null, directory)
    expect(await readAgentHubOrbMemory(directory)).toEqual([])
    expect(await readFile(join(directory, 'MEMORY.md'), 'utf8')).toContain('# Memory')
  })

  it('reads as empty when the file is missing', async () => {
    expect(await readAgentHubOrbMemory(directory)).toEqual([])
  })
})
