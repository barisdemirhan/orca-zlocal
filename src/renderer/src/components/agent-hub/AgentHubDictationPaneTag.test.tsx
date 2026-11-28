/** @vitest-environment happy-dom */
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentHubDictationPaneTag } from './AgentHubDictationPaneTag'
import { noteAgentHubDictationState } from './agent-hub-dictation-origin'
import { useMirrorShowsDictation } from './agent-hub-mirror-dictation-display'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ dictationState: 'idle' })) }
})

afterEach(() => {
  act(() => noteAgentHubDictationState('idle'))
  cleanup()
  document.body.replaceChildren()
})

function mountPane(): HTMLElement {
  const tab = document.createElement('div')
  tab.dataset.terminalTabId = 'tab-1'
  const pane = document.createElement('div')
  pane.className = 'pane'
  pane.dataset.leafId = 'leaf-1'
  const input = document.createElement('textarea')
  input.className = 'xterm-helper-textarea'
  pane.append(input)
  tab.append(pane)
  document.body.append(tab)
  input.focus()
  return pane
}

const tag = (): Element | null => document.querySelector('[data-agent-hub-dictation-pane-tag]')

it('tags the pane a dictation went into until the dictation ends', () => {
  const pane = mountPane()
  render(<AgentHubDictationPaneTag />)
  expect(tag()).toBeNull()

  act(() => noteAgentHubDictationState('listening'))
  expect(tag()?.closest('.pane')).toBe(pane)
  expect(tag()?.textContent).toContain('Dictating here')

  act(() => noteAgentHubDictationState('idle'))
  expect(tag()).toBeNull()
})

it('stands down while a mirror shows the dictation itself', () => {
  mountPane()
  act(() => noteAgentHubDictationState('listening'))
  render(<AgentHubDictationPaneTag />)
  expect(tag()).not.toBeNull()

  const mirror = renderHook(() => useMirrorShowsDictation(true))
  expect(tag()).toBeNull()
  mirror.unmount()
  expect(tag()).not.toBeNull()
})
