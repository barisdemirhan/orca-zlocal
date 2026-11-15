// @vitest-environment happy-dom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { DictationController } from './DictationController'
import { dispatchDictationControl } from './dictation-control-events'
import { cancelDictation, canCancelDictation } from '../agent-hub/agent-hub-dictation-cancel'

const mocks = vi.hoisted(() => {
  const callbacks: {
    final?: (data: { sessionId: string; text: string }) => void
    stopped?: (data: { sessionId: string }) => void
  } = {}
  return {
    callbacks,
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
    finish: vi.fn(async () => undefined),
    discard: vi.fn(),
    flush: vi.fn(async () => undefined),
    insert: vi.fn(),
    startSpeech: vi.fn<typeof window.api.speech.startDictation>(async () => undefined),
    stopSpeech: vi.fn(async () => undefined),
    cancelSpeech: vi.fn(async () => undefined)
  }
})
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { createGlobalSettingsFixture } =
    await import('../../../../shared/global-settings-test-fixture')
  const { getDefaultVoiceSettings } = await import('../../../../shared/constants')
  const store = create(() => ({
    dictationState: 'idle',
    liveText: { committed: '', tentative: '', speechPending: false },
    keybindings: {},
    settings: createGlobalSettingsFixture({
      voice: {
        ...getDefaultVoiceSettings(),
        enabled: true,
        sttModel: 'test',
        dictationMode: 'toggle'
      }
    }),
    setDictationState: (dictationState: string) => store.setState({ dictationState }),
    setLiveText: (liveText: { committed: string; tentative: string; speechPending: boolean }) =>
      store.setState({ liveText }),
    recordFeatureInteraction: vi.fn()
  }))
  return { useAppStore: store }
})
vi.mock('@/hooks/use-audio-capture', () => ({
  useAudioCapture: () => ({
    start: mocks.start,
    stop: mocks.stop,
    discardBufferedAudio: mocks.discard,
    flushBufferedAudio: mocks.flush,
    finish: mocks.finish,
    getLastSpeechAt: () => 0,
    getCapturedChunkCount: () => 1
  })
}))
vi.mock('./DictationIndicator', () => ({ DictationIndicator: () => null }))
vi.mock('./use-dictation-terminal-mount-lease', () => ({
  useDictationTerminalMountLease: () => ({ current: null })
}))
vi.mock(import('./dictation-insertion-target'), async (original) => ({
  ...(await original()),
  insertText: mocks.insert
}))
beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ dictationState: 'idle' })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      ui: { onDictationKeyDown: () => () => {} },
      speech: {
        startDictation: mocks.startSpeech,
        stopDictation: mocks.stopSpeech,
        cancelDictation: mocks.cancelSpeech,
        onSpeechPending: () => () => {},
        onPartialTranscript: () => () => {},
        onError: () => () => {},
        onFinalTranscript: (callback: NonNullable<typeof mocks.callbacks.final>) => {
          mocks.callbacks.final = callback
          return () => {}
        },
        onStopped: (callback: NonNullable<typeof mocks.callbacks.stopped>) => {
          mocks.callbacks.stopped = callback
          return () => {}
        }
      }
    }
  })
})
afterEach(cleanup)

it('advertises cancel, cancels an active capture and engine session, and ignores the final transcript arriving during teardown', async () => {
  const view = render(
    <>
      <textarea aria-label="Reply" />
      <DictationController />
    </>
  )
  view.getByRole('textbox', { name: 'Reply' }).focus()
  expect(canCancelDictation()).toBe(true)
  act(() => dispatchDictationControl('start'))
  await waitFor(() => expect(useAppStore.getState().dictationState).toBe('listening'))
  act(cancelDictation)
  expect(mocks.stop).toHaveBeenCalled()
  expect(mocks.cancelSpeech).toHaveBeenCalledOnce()
  const sessionId = mocks.startSpeech.mock.calls[0]?.[2]
  if (!sessionId) {
    throw new Error('No speech session')
  }
  act(() => mocks.callbacks.final?.({ sessionId, text: 'Must not insert or submit' }))
  expect(mocks.insert).not.toHaveBeenCalled()
  act(() => mocks.callbacks.stopped?.({ sessionId }))
  await waitFor(() => expect(useAppStore.getState().dictationState).toBe('idle'))
  act(cancelDictation)
  expect(mocks.startSpeech).toHaveBeenCalledTimes(1)
})
