import { describe, expect, it } from 'vitest'
import { buildAgentHubOrbIdentityBlock } from './agent-hub-orb-identity-block'

const entry = (day: number, text: string) => ({
  line: `- [2026-10-${String(day).padStart(2, '0')}] ${text}`,
  text,
  date: `2026-10-${String(day).padStart(2, '0')}`
})

describe('buildAgentHubOrbIdentityBlock', () => {
  it('is empty when nothing was customised and suggestions are off', () => {
    expect(
      buildAgentHubOrbIdentityBlock({
        name: 'Orb',
        soul: '',
        user: '',
        memory: [],
        memorySuggestions: false
      })
    ).toEqual({ text: '', truncated: false })
  })

  it('writes the identity sections and only mentions remember when suggestions are on', () => {
    const input = {
      name: 'Luna',
      soul: 'Be brief.',
      user: 'Prefers Turkish.',
      memory: [entry(1, 'Uses pnpm')]
    }
    const on = buildAgentHubOrbIdentityBlock({ ...input, memorySuggestions: true }).text
    const off = buildAgentHubOrbIdentityBlock({ ...input, memorySuggestions: false }).text
    expect(on).toContain('Your name is Luna.')
    expect(on).toContain('## About the user\n\nPrefers Turkish.')
    expect(on).toContain('## Memory\n\n- [2026-10-01] Uses pnpm')
    expect(on).toContain('orca hub orb remember')
    expect(off).not.toContain('orca hub orb remember')
  })

  it('drops the oldest memories first, then cuts USER, then SOUL', () => {
    const memory = [1, 2, 3, 4].map((day) => entry(day, `fact ${day} ${'x'.repeat(100)}`))
    const base = {
      name: 'Orb',
      soul: 'S'.repeat(300),
      user: 'U'.repeat(300),
      memorySuggestions: false
    }
    const memoryOnly = buildAgentHubOrbIdentityBlock({ ...base, memory }, 900)
    expect(memoryOnly.truncated).toBe(true)
    expect(memoryOnly.text).not.toContain('fact 1')
    expect(memoryOnly.text).toContain('fact 4')
    expect(memoryOnly.text).toContain('U'.repeat(300))

    const cut = buildAgentHubOrbIdentityBlock({ ...base, memory }, 500)
    expect(cut.text.length).toBeLessThanOrEqual(500)
    expect(cut.text).not.toContain('## Memory')
    expect(cut.text).toContain('S'.repeat(300))
    expect(cut.text).not.toContain('U'.repeat(300))

    const soulCut = buildAgentHubOrbIdentityBlock({ ...base, memory }, 150)
    expect(soulCut.text.length).toBeLessThanOrEqual(150)
    expect(soulCut.text).not.toContain('## About the user')
  })
})
