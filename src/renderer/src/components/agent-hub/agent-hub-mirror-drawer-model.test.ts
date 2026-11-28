import { describe, expect, it } from 'vitest'
import { createAgentHubMirrorDrawerModel } from './agent-hub-mirror-drawer-model'

describe('agent hub mirror drawer rules', () => {
  it('refuses an agent that reopens what the user closed until a new turn starts', () => {
    const model = createAgentHubMirrorDrawerModel({ ownCardAllowed: () => true })
    expect(model.open('a', 'pr', 'agent')).toBe('opened')
    model.close('a', 'user')
    expect(model.shown('a')).toBeNull()
    expect(model.open('a', 'pr', 'agent')).toBe('closed-by-user')
    model.noteTurnStarted('a')
    expect(model.open('a', 'pr', 'agent')).toBe('opened')
  })

  it('lets the user reopen at once and clears the refusal', () => {
    const model = createAgentHubMirrorDrawerModel({ ownCardAllowed: () => true })
    model.open('a', 'work', 'user')
    model.close('a', 'user')
    model.open('a', 'changes', 'user')
    expect(model.open('a', 'pr', 'agent')).toBe('opened')
  })

  it('keeps an agent off a card it may not use, and off the drawer it cannot close', () => {
    let allowed = true
    const model = createAgentHubMirrorDrawerModel({ ownCardAllowed: () => allowed })
    model.open('a', 'work', 'user')
    model.setAgentMayUseCard('a', false)
    expect(model.open('a', 'pr', 'agent')).toBe('not-available')
    model.close('a', 'agent')
    expect(model.shown('a')).toBe('work')
    model.setAgentMayUseCard('a', true)
    allowed = false
    expect(model.open('a', 'pr', 'agent')).toBe('not-available')
  })

  it('keeps the last hundred events and reads only those after a sequence', () => {
    const model = createAgentHubMirrorDrawerModel({ ownCardAllowed: () => true })
    for (let i = 0; i < 130; i++) {
      model.recordEvent('a', { kind: 'tab-shown' })
    }
    const all = model.readEvents('a', 0)
    expect(all).toHaveLength(100)
    const mid = all[49]!.seq
    expect(model.readEvents('a', mid)).toHaveLength(50)
  })
})
