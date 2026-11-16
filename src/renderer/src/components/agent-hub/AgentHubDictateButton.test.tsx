/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Profiler, createRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { NO_DICTATION_LIVE_TEXT } from '@/store/slices/dictation/dictation'
import { getDefaultSettings, getDefaultVoiceSettings } from '../../../../shared/constants'
import type { DictationState } from '../../../../shared/speech/speech-types'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import { publishDictationMeter, resetDictationMeter } from '../dictation/dictation-meter-store'
import { DictationIndicator } from '../dictation/DictationIndicator'
import { TooltipProvider } from '../ui/tooltip'
import { HubDictateButton } from './AgentHubDictateButton'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  type StoreState = Pick<
    ReturnType<typeof useAppStore.getState>,
    'dictationState' | 'liveText' | 'keybindings' | 'settings'
  >
  return {
    useAppStore: create<StoreState>(() => ({
      dictationState: 'idle',
      liveText: { committed: '', tentative: '', speechPending: false },
      keybindings: {},
      settings: null
    }))
  }
})
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const actions: unknown[] = []
function receiveControl(event: Event): void {
  if (event instanceof CustomEvent) {
    actions.push(event.detail)
  }
}

beforeEach(() => {
  const settings = getDefaultSettings('/test')
  useAppStore.setState({
    dictationState: 'idle',
    liveText: NO_DICTATION_LIVE_TEXT,
    keybindings: {},
    settings: { ...settings, voice: { ...getDefaultVoiceSettings(), enabled: true } }
  })
  resetDictationMeter()
  actions.length = 0
  document.addEventListener(DICTATION_CONTROL_EVENT, receiveControl)
})
afterEach(() => {
  cleanup()
  resetDictationMeter()
  document.removeEventListener(DICTATION_CONTROL_EVENT, receiveControl)
})

function ReplySurface({ compact = false, showField = true }) {
  return (
    <TooltipProvider>
      {showField ? (
        <form aria-label="Reply">
          <input aria-label="Reply" />
          <HubDictateButton compact={compact} />
        </form>
      ) : null}
      <DictationIndicator
        captureLive={false}
        anchor={null}
        failure={null}
        queued={null}
        setup={null}
        onSetupClose={() => {}}
        cleanup={{ cleaning: false, notice: null, dismissNotice: () => {} }}
      />
    </TooltipProvider>
  )
}

function setDictationState(dictationState: DictationState): void {
  act(() => useAppStore.setState({ dictationState }))
}

it.each([false, true])(
  'uses the hub microphone default with improvement capability=%s',
  (available) => {
    const settings = useAppStore.getState().settings
    if (!settings) {
      throw new Error('Missing test settings')
    }
    useAppStore.setState({ settings: { ...settings, agentHubMicMode: 'improve' } })
    const capabilities = (event: Event): void => {
      if (event instanceof CustomEvent) {
        event.detail.improve = available
      }
    }
    document.addEventListener('dictation:capabilities', capabilities)
    try {
      render(<ReplySurface />)
      fireEvent.click(screen.getByRole('button', { name: /^Dictate/ }))
      expect(actions).toEqual(available ? [{ action: 'start', improve: true }] : ['toggle'])
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reply' }))
    } finally {
      document.removeEventListener('dictation:capabilities', capabilities)
    }
  }
)

it.each([false, true])('keeps field-started dictation inline with compact=%s', (compact) => {
  render(<ReplySurface compact={compact} />)
  const mic = screen.getByRole('button', { name: 'Dictate' })
  expect(mic.getAttribute('data-size')).toBe(compact ? 'icon-xs' : 'icon-sm')

  fireEvent.click(mic)
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reply' }))
  expect(actions).toEqual(['toggle'])

  setDictationState('starting')
  const stop = screen.getByRole('button', { name: 'Stop dictation' })
  expect(screen.queryByTestId('dictation-indicator')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Starting mic…')
  const grapes = within(screen.getByRole('form', { name: 'Reply' })).getByTestId('dictation-grapes')
  expect(screen.queryByRole('button', { name: 'Cancel dictation' })).toBeNull()
  expect(grapes.classList.contains('animate-pulse')).toBe(true)

  setDictationState('listening')
  expect(screen.queryByTestId('dictation-indicator')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Listening')
  expect(screen.getByText('Listening', { selector: 'span[aria-hidden]' })).toBeTruthy()
  act(() =>
    useAppStore.setState({
      liveText: { committed: '', tentative: 'Not inserted yet', speechPending: false }
    })
  )
  expect(screen.queryByText('Not inserted yet')).toBeNull()
  expect(grapes.classList.contains('animate-pulse')).toBe(false)
  const quietGrape = grapes.firstElementChild?.getAttribute('style')
  act(() => publishDictationMeter({ level: 0.75, isSpeaking: true, isClipping: false }))
  expect(grapes.firstElementChild?.getAttribute('style')).not.toBe(quietGrape)
  expect(screen.getByText('Speaking')).toBeTruthy()
  act(() => publishDictationMeter({ level: 1, isSpeaking: true, isClipping: true }))
  expect(screen.getByRole('status').textContent).toBe('Too loud')

  expect(fireEvent.mouseDown(stop)).toBe(false)
  fireEvent.click(stop)
  expect(actions).toEqual(['toggle', 'stop'])
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reply' }))
  setDictationState('stopping')
  expect(screen.queryByTestId('dictation-indicator')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Processing…')
  expect(screen.queryByRole('button', { name: 'Stop dictation' })).toBeNull()
  expect(grapes.classList.contains('animate-pulse')).toBe(true)
  expect(grapes.firstElementChild?.getAttribute('style')).toBe(quietGrape)

  setDictationState('idle')
  act(resetDictationMeter)
  expect(screen.queryByTestId('dictation-grapes')).toBeNull()
  const idleMic = screen.getByRole('button', { name: 'Dictate' })
  expect(idleMic.getAttribute('data-agent-hub-dictate')).toBe('idle')
  setDictationState('listening')
  expect(screen.getByTestId('dictation-indicator').textContent).toContain('Listening')
  expect(idleMic.getAttribute('data-agent-hub-dictate')).toBe('elsewhere')
})

it.each([
  { mode: 'toggle', bound: true, shown: true },
  { mode: 'hold', bound: true, shown: false },
  { mode: 'toggle', bound: false, shown: false }
] as const)(
  'shows bound stop keycaps only in toggle mode: $mode/$bound',
  ({ mode, bound, shown }) => {
    const settings = getDefaultSettings('/test')
    useAppStore.setState({
      settings: {
        ...settings,
        voice: { ...getDefaultVoiceSettings(), enabled: true, dictationMode: mode }
      },
      keybindings: bound ? {} : { 'voice.dictation': [] }
    })
    render(<ReplySurface />)
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
    setDictationState('listening')

    const hint = document.querySelector('[data-agent-hub-dictation-stop-key]')
    expect(hint !== null).toBe(shown)
    if (shown) {
      expect(hint?.textContent).toMatch(/E.*to stop/)
    }
  }
)

it.each(['listening', 'stopping'] as const)(
  'cancels through the mounted controller without leaving the reply field in %s',
  (phase) => {
    const advertiseCancel = (event: Event): void => {
      if (event instanceof CustomEvent) {
        event.detail.cancel = true
      }
    }
    document.addEventListener('dictation:capabilities', advertiseCancel)
    try {
      render(<ReplySurface />)
      fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
      setDictationState(phase)
      const input = screen.getByRole('textbox', { name: 'Reply' })
      fireEvent.change(input, { target: { value: 'Already inserted' } })
      const cancel = screen.getByRole('button', { name: 'Cancel dictation' })

      expect(fireEvent.mouseDown(cancel)).toBe(false)
      fireEvent.click(cancel)
      expect(actions).toEqual(['toggle', 'cancel'])
      expect(document.activeElement).toBe(input)
      expect(screen.getByDisplayValue('Already inserted')).toBe(input)
    } finally {
      document.removeEventListener('dictation:capabilities', advertiseCancel)
    }
  }
)

it('keeps other reply mics inert and does not render them on meter ticks', () => {
  const listeningRender = vi.fn()
  const otherRender = vi.fn()
  render(
    <TooltipProvider>
      <Profiler id="listening" onRender={listeningRender}>
        <form aria-label="Listening reply">
          <input aria-label="Listening reply" />
          <HubDictateButton />
        </form>
      </Profiler>
      <Profiler id="other" onRender={otherRender}>
        <form aria-label="Other reply">
          <input aria-label="Other reply" />
          <HubDictateButton />
        </form>
      </Profiler>
    </TooltipProvider>
  )
  fireEvent.click(within(screen.getByRole('form', { name: 'Listening reply' })).getByRole('button'))
  setDictationState('listening')
  const otherMic = within(screen.getByRole('form', { name: 'Other reply' })).getByRole('button')
  fireEvent.click(otherMic)
  expect(actions).toEqual(['toggle'])
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Listening reply' }))
  listeningRender.mockClear()
  otherRender.mockClear()

  act(() => publishDictationMeter({ level: 0.75, isSpeaking: true, isClipping: false }))

  expect(listeningRender).toHaveBeenCalled()
  expect(otherRender).not.toHaveBeenCalled()
})

it('leaves dictation started elsewhere with the app-wide indicator', () => {
  render(<ReplySurface />)
  setDictationState('listening')
  const mic = screen.getByRole('button', { name: 'Dictate' })

  expect(screen.getByTestId('dictation-indicator').textContent).toContain('Listening')
  expect(mic.getAttribute('aria-pressed')).toBe('false')
  expect(mic.getAttribute('aria-disabled')).toBe('true')
  expect(mic.getAttribute('data-agent-hub-dictate')).toBe('elsewhere')
  expect(within(mic).queryByTestId('dictation-grapes')).toBeNull()
  fireEvent.click(mic)
  expect(actions).toEqual([])
})

it('returns the running indicator to the app when the reply field goes away', () => {
  const view = render(<ReplySurface />)
  fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
  setDictationState('listening')
  expect(screen.queryByTestId('dictation-indicator')).toBeNull()

  view.rerender(<ReplySurface showField={false} />)

  expect(screen.getByTestId('dictation-indicator').textContent).toContain('Listening')
  expect(useAppStore.getState().dictationState).toBe('listening')
})

it('focuses the multiline answer field when the single-line one is not mounted', () => {
  const inputRef = createRef<HTMLInputElement>()
  const textareaRef = createRef<HTMLTextAreaElement>()
  render(
    <TooltipProvider>
      <textarea ref={textareaRef} aria-label="Answer" />
      <HubDictateButton compact targetInputRef={inputRef} targetTextareaRef={textareaRef} />
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: /^Dictate/ }))
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Answer' }))
  expect(actions).toEqual(['toggle'])
})
