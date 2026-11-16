/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DictationState } from '../../../../shared/speech/speech-types'

const store = vi.hoisted(() => {
  type State = { dictationState: DictationState }
  let state: State = { dictationState: 'idle' }
  const listeners = new Set<(state: State, previous: State) => void>()
  return {
    getState: () => state,
    subscribe: (listener: (state: State, previous: State) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setDictationState: (dictationState: DictationState) => {
      const previous = state
      state = { dictationState }
      listeners.forEach((listener) => listener(state, previous))
    }
  }
})

vi.mock('@/store', () => ({ useAppStore: store }))

import { act, renderHook } from '@testing-library/react'
import {
  trackAgentHubDictationOrigin,
  useAgentHubDictationSession
} from './agent-hub-dictation-origin'
import { mirrorOwnsDictation, type AgentHubDictationPane } from './agent-hub-mirror-mic-state'

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'

/** A terminal pane as the app renders it, with xterm's focusable input inside. */
function mountTerminal(tabId: string, leafId: string): HTMLTextAreaElement {
  const tab = document.createElement('div')
  tab.dataset.terminalTabId = tabId
  const pane = document.createElement('div')
  pane.className = 'pane'
  pane.dataset.leafId = leafId
  const input = document.createElement('textarea')
  input.className = 'xterm-helper-textarea'
  pane.append(input)
  tab.append(pane)
  document.body.append(tab)
  return input
}

function mirrorPane(tabId: string, leafId: string): AgentHubDictationPane {
  return { tabId, leafId }
}

let stopTracking: () => void

function setDictationState(state: DictationState): void {
  act(() => store.setDictationState(state))
}

beforeEach(() => {
  stopTracking = trackAgentHubDictationOrigin()
})

afterEach(() => {
  setDictationState('idle')
  stopTracking()
  document.body.replaceChildren()
})

describe('dictation origin', () => {
  it('keeps Orb composer dictation on its tab even when focus moves to history', () => {
    const slot = document.createElement('div')
    slot.dataset.agentHubOrbChatTabId = 'orb-tab'
    const composer = document.createElement('textarea')
    slot.append(composer)
    document.body.append(slot)
    const history = document.createElement('input')
    document.body.append(history)
    const { result } = renderHook(() => useAgentHubDictationSession())
    composer.focus()
    setDictationState('starting')
    expect(result.current).toEqual({ pane: { tabId: 'orb-tab', leafId: null } })
    history.focus()
    setDictationState('stopping')
    expect(result.current?.pane?.tabId).toBe('orb-tab')
  })
  it('ties a dictation to the terminal focused when it started, as the shortcut does', () => {
    const inputA = mountTerminal('tab-1', LEAF_A)
    mountTerminal('tab-2', LEAF_B)
    const { result } = renderHook(() => useAgentHubDictationSession())
    expect(result.current).toBeNull()

    inputA.focus()
    setDictationState('starting')

    expect(result.current).toEqual({
      pane: { tabId: 'tab-1', leafId: LEAF_A }
    })
    expect(mirrorOwnsDictation(result.current, mirrorPane('tab-1', LEAF_A))).toBe(true)
    expect(mirrorOwnsDictation(result.current, mirrorPane('tab-2', LEAF_B))).toBe(false)
  })

  it('keeps that terminal for the whole dictation when focus moves away', () => {
    const inputA = mountTerminal('tab-1', LEAF_A)
    const inputB = mountTerminal('tab-2', LEAF_B)
    const { result } = renderHook(() => useAgentHubDictationSession())
    inputA.focus()
    setDictationState('starting')

    inputB.focus()
    setDictationState('listening')
    expect(mirrorOwnsDictation(result.current, mirrorPane('tab-1', LEAF_A))).toBe(true)
    expect(mirrorOwnsDictation(result.current, mirrorPane('tab-2', LEAF_B))).toBe(false)

    inputB.blur()
    setDictationState('stopping')
    expect(mirrorOwnsDictation(result.current, mirrorPane('tab-1', LEAF_A))).toBe(true)
  })

  it('forgets the terminal when the dictation ends, so the next one is read afresh', () => {
    const inputA = mountTerminal('tab-1', LEAF_A)
    const inputB = mountTerminal('tab-2', LEAF_B)
    const { result } = renderHook(() => useAgentHubDictationSession())
    inputA.focus()
    setDictationState('listening')
    setDictationState('idle')
    expect(result.current).toBeNull()

    inputB.focus()
    setDictationState('starting')
    expect(mirrorOwnsDictation(result.current, mirrorPane('tab-2', LEAF_B))).toBe(true)
  })

  it('belongs to no mirror when it starts outside a terminal', () => {
    mountTerminal('tab-1', LEAF_A)
    const field = document.createElement('input')
    document.body.append(field)
    const { result } = renderHook(() => useAgentHubDictationSession())
    field.focus()
    setDictationState('starting')

    expect(result.current).toEqual({ pane: null })
    expect(mirrorOwnsDictation(result.current, mirrorPane('tab-1', LEAF_A))).toBe(false)
  })

  it('counts a dictation already running when tracking starts as elsewhere', () => {
    stopTracking()
    const inputA = mountTerminal('tab-1', LEAF_A)
    inputA.focus()
    setDictationState('listening')
    stopTracking = trackAgentHubDictationOrigin()
    const { result } = renderHook(() => useAgentHubDictationSession())

    expect(result.current).toEqual({ pane: null })
  })
})
