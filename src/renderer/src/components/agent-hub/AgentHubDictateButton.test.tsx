/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings, getDefaultVoiceSettings } from '../../../../shared/constants'
import type { DictationState } from '../../../../shared/speech-types'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import { publishDictationMeter, resetDictationMeter } from '../dictation/dictation-meter-store'
import { DictationIndicator } from '../dictation/DictationIndicator'
import { TooltipProvider } from '../ui/tooltip'
import { HubDictateButton } from './AgentHubDictateButton'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  type StoreState = Pick<
    ReturnType<typeof useAppStore.getState>,
    'dictationState' | 'partialTranscript' | 'keybindings' | 'settings'
  >
  return {
    useAppStore: create<StoreState>(() => ({
      dictationState: 'idle',
      partialTranscript: '',
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
    partialTranscript: '',
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
        <form>
          <input aria-label="Reply" />
          <HubDictateButton compact={compact} />
        </form>
      ) : null}
      <DictationIndicator />
    </TooltipProvider>
  )
}

function setDictationState(dictationState: DictationState): void {
  act(() => useAppStore.setState({ dictationState }))
}

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
  expect(stop.getAttribute('aria-pressed')).toBe('true')
  expect(stop.getAttribute('data-agent-hub-dictate')).toBe('listening')
  const grapes = within(stop).getByTestId('dictation-grapes')
  expect(grapes.classList.contains('animate-pulse')).toBe(true)

  setDictationState('listening')
  expect(screen.queryByTestId('dictation-indicator')).toBeNull()
  expect(grapes.classList.contains('animate-pulse')).toBe(false)
  const quietGrape = grapes.firstElementChild?.getAttribute('style')
  act(() => publishDictationMeter({ level: 0.75, isSpeaking: true, isClipping: false }))
  expect(grapes.firstElementChild?.getAttribute('style')).not.toBe(quietGrape)

  fireEvent.click(stop)
  expect(actions).toEqual(['toggle', 'stop'])
  setDictationState('stopping')
  expect(screen.queryByTestId('dictation-indicator')).toBeNull()
  expect(grapes.classList.contains('animate-pulse')).toBe(true)
  expect(grapes.firstElementChild?.getAttribute('style')).toBe(quietGrape)

  setDictationState('idle')
  expect(screen.queryByTestId('dictation-grapes')).toBeNull()
  expect(mic.getAttribute('data-agent-hub-dictate')).toBe('idle')
  setDictationState('listening')
  expect(screen.getByTestId('dictation-indicator').textContent).toContain('Listening')
  expect(mic.getAttribute('data-agent-hub-dictate')).toBe('elsewhere')
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
