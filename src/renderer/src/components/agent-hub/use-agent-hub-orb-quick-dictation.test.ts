// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import {
  AGENT_HUB_ORB_QUICK_SETTLE_MS,
  useAgentHubOrbQuickDictation
} from './use-agent-hub-orb-quick-dictation'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ dictationState: 'idle', settings: undefined })) }
})

const actions: unknown[] = []
const control = (event: Event): void => {
  if (event instanceof CustomEvent) {
    actions.push(typeof event.detail === 'string' ? event.detail : event.detail.action)
  }
}
let input: HTMLInputElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
  actions.length = 0
  useAppStore.setState({ dictationState: 'idle' })
  input = document.createElement('input')
  document.body.append(input)
  document.addEventListener(DICTATION_CONTROL_EVENT, control)
})
afterEach(() => {
  document.removeEventListener(DICTATION_CONTROL_EVENT, control)
  input.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function dictation(onSend = vi.fn()) {
  const inputRef = { current: input }
  const hook = renderHook(() =>
    useAgentHubOrbQuickDictation({ inputRef, prepare: async () => true, onSend })
  )
  return { ...hook, onSend }
}

it('records into the focused box and sends once the last segment has landed', async () => {
  const { result, onSend } = dictation()
  await act(async () => result.current.start())
  expect(document.activeElement).toBe(input)
  expect(actions).toEqual(['start'])
  expect(result.current.active).toBe(true)
  act(() => useAppStore.setState({ dictationState: 'starting' }))
  expect(result.current.phase).toBe('starting')
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  expect(result.current.phase).toBe('listening')
  input.value = 'Run the'
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  expect(result.current.active).toBe(false)
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_QUICK_SETTLE_MS - 100))
  input.value = 'Run the tests'
  act(() => result.current.onInput())
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_QUICK_SETTLE_MS - 100))
  expect(onSend).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(100))
  expect(onSend).toHaveBeenCalledOnce()
})

it('keeps an empty or edited box instead of sending it', async () => {
  const { result, onSend } = dictation()
  await act(async () => result.current.start())
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_QUICK_SETTLE_MS))
  expect(onSend).not.toHaveBeenCalled()
  expect(result.current.missed).toBe(true)
  await act(async () => result.current.start())
  expect(result.current.missed).toBe(false)
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  input.value = 'Draft'
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  act(() => result.current.onKeyDown())
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_QUICK_SETTLE_MS))
  expect(onSend).not.toHaveBeenCalled()
})

it('stops a recording released before it started and throws one away on unmount', async () => {
  const { result, unmount } = dictation()
  let ready: (value: boolean) => void = () => {}
  const inputRef = { current: input }
  const pending = renderHook(() =>
    useAgentHubOrbQuickDictation({
      inputRef,
      prepare: () => new Promise<boolean>((resolve) => (ready = resolve)),
      onSend: vi.fn()
    })
  )
  act(() => pending.result.current.start())
  act(() => pending.result.current.stop())
  await act(async () => ready(true))
  expect(actions).toEqual(['start', 'stop'])
  pending.unmount()
  actions.length = 0
  await act(async () => result.current.start())
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  unmount()
  expect(actions).toEqual(['start', 'cancel'])
})
