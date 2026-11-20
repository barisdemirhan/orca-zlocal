import { describe, expect, it } from 'vitest'
import {
  moveAgentHubSelection,
  nextAgentHubTab,
  resolveAgentHubKeyAction,
  type AgentHubKeyContext,
  type AgentHubKeyInput
} from './agent-hub-keys'

const idle: AgentHubKeyContext = {
  tab: 'inbox',
  inTextField: false,
  inSearch: false,
  onButton: false,
  hasCard: true
}

function key(name: string, modifiers: Partial<AgentHubKeyInput> = {}): AgentHubKeyInput {
  return { key: name, altKey: false, metaKey: false, ctrlKey: false, shiftKey: false, ...modifiers }
}

describe('resolveAgentHubKeyAction', () => {
  it('answers the visible card with number keys', () => {
    expect(resolveAgentHubKeyAction(key('2'), idle)).toEqual({ type: 'answer', optionIndex: 1 })
  })

  it('lets number keys type into a text field and ignores them without a card', () => {
    expect(resolveAgentHubKeyAction(key('2'), { ...idle, inTextField: true })).toBeNull()
    expect(resolveAgentHubKeyAction(key('2'), { ...idle, hasCard: false })).toBeNull()
    expect(resolveAgentHubKeyAction(key('2'), { ...idle, tab: 'running' })).toBeNull()
  })

  it('opens with Enter and pops out with Alt+Enter, but not from a focused button', () => {
    expect(resolveAgentHubKeyAction(key('Enter'), idle)).toEqual({ type: 'open', popout: false })
    expect(resolveAgentHubKeyAction(key('Enter', { altKey: true }), idle)).toEqual({
      type: 'open',
      popout: true
    })
    expect(resolveAgentHubKeyAction(key('Enter'), { ...idle, onButton: true })).toBeNull()
  })

  it('keeps list keys working from the search box but not from an answer field', () => {
    const search = { ...idle, tab: 'all' as const, inTextField: true, inSearch: true }
    expect(resolveAgentHubKeyAction(key('ArrowDown'), search)).toEqual({
      type: 'moveSelection',
      delta: 1
    })
    expect(resolveAgentHubKeyAction(key('Tab', { shiftKey: true }), search)).toEqual({
      type: 'switchTab',
      direction: -1
    })
    expect(resolveAgentHubKeyAction(key('ArrowDown'), { ...idle, inTextField: true })).toBeNull()
  })

  it('leaves app chords to the global shortcut handler', () => {
    expect(resolveAgentHubKeyAction(key('Enter', { metaKey: true }), idle)).toBeNull()
    expect(resolveAgentHubKeyAction(key('j', { ctrlKey: true, altKey: true }), idle)).toBeNull()
  })
})

describe('agent hub selection helpers', () => {
  it('cycles tabs in both directions', () => {
    expect(nextAgentHubTab('inbox', 1)).toBe('running')
    expect(nextAgentHubTab('inbox', -1)).toBe('all')
    expect(nextAgentHubTab('all', 1)).toBe('inbox')
  })

  it('enters the list from either end and steps back out above the first row', () => {
    expect(moveAgentHubSelection(-1, 1, 3)).toBe(0)
    expect(moveAgentHubSelection(-1, -1, 3)).toBe(2)
    expect(moveAgentHubSelection(2, 1, 3)).toBe(2)
    expect(moveAgentHubSelection(0, -1, 3)).toBe(-1)
    expect(moveAgentHubSelection(0, 1, 0)).toBe(-1)
  })
})
