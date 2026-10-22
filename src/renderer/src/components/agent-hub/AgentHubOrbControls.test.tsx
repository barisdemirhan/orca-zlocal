// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentHubOrbControls } from './AgentHubOrbControls'

type Controls = Parameters<typeof AgentHubOrbControls>[0]

function controls(overrides: Partial<Controls> = {}): Controls {
  return {
    voice: {
      capability: 'supported',
      canStart: true,
      connection: 'off',
      input: 'listening',
      output: 'silent',
      outputMuted: false,
      textMode: true,
      startLive: vi.fn(async () => {}),
      stopLive: vi.fn(async () => {}),
      muteInput: vi.fn(),
      muteOutput: vi.fn(),
      stopSpeaking: vi.fn(),
      switchToText: vi.fn(async () => {}),
      prepareDictation: vi.fn(async () => true)
    },
    codex: true,
    orbView: true,
    compact: false,
    busy: false,
    dictating: false,
    onShowChat: vi.fn(),
    onShowOrb: vi.fn(),
    onCompact: vi.fn(),
    onModeChange: vi.fn(),
    onText: vi.fn(),
    onDictate: vi.fn(),
    onStopDictation: vi.fn(),
    onCancelDictation: vi.fn(),
    onHistory: vi.fn(),
    onSettings: vi.fn(),
    onNew: vi.fn(),
    onSleep: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  }
}

const view = (props: Controls) => (
  <TooltipProvider>
    <AgentHubOrbControls {...props} />
  </TooltipProvider>
)

afterEach(cleanup)

it('offers text recovery after Live fails before the voice controller returns to text mode', () => {
  const props = controls({ orbView: false })
  props.voice.connection = 'error'
  props.voice.textMode = false
  const { rerender } = render(view(props))
  fireEvent.click(screen.getByRole('radio', { name: 'Switch to text', checked: false }))
  expect(props.onText).toHaveBeenCalledOnce()
  expect(props.onShowOrb).not.toHaveBeenCalled()
  props.voice.textMode = true
  rerender(view(props))
  expect(screen.getByRole('radio', { name: 'Orb view', checked: true })).toBeTruthy()
})

it('starts Live or opens text directly and returns to the Orb when text is pressed again', () => {
  const props = controls()
  const { rerender } = render(view(props))
  const modes = within(screen.getByRole('radiogroup', { name: 'Orb mode' }))
  fireEvent.click(modes.getByRole('radio', { name: 'Start live voice' }))
  expect(props.voice.startLive).toHaveBeenCalledOnce()
  fireEvent.click(modes.getByRole('radio', { name: 'Switch to text' }))
  expect(props.onText).toHaveBeenCalledOnce()
  rerender(view({ ...props, orbView: false }))
  const text = screen.getByRole('radio', { name: 'Orb view', checked: true })
  expect(text.getAttribute('data-state')).toBe('on')
  fireEvent.click(text)
  expect(props.onShowOrb).toHaveBeenCalledOnce()
})

it.each(['connecting', 'live'] as const)(
  'keeps %s Live when its selected mode is pressed again',
  (connection) => {
    const props = controls({ busy: true })
    props.voice.connection = connection
    render(view(props))
    fireEvent.click(screen.getByRole('radio', { name: 'Live voice on', checked: true }))
    expect(props.voice.stopLive).not.toHaveBeenCalled()
    expect(props.voice.startLive).not.toHaveBeenCalled()
  }
)

it('waits for Live to stop before passing control to dictation', async () => {
  const props = controls()
  props.voice.connection = 'live'
  let stopped: (() => void) | undefined
  props.voice = {
    ...props.voice,
    stopLive: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          stopped = resolve
        })
    )
  }
  render(view(props))
  fireEvent.click(screen.getByRole('radio', { name: 'Dictate' }))
  expect(props.voice.stopLive).toHaveBeenCalledOnce()
  expect(props.onDictate).not.toHaveBeenCalled()
  await act(async () => stopped?.())
  expect(props.onDictate).toHaveBeenCalledOnce()
})

it('finishes and sends active dictation from its mode while keeping cancellation separate', () => {
  const props = controls({ dictating: true })
  render(view(props))
  const live = screen.getByRole('radio', { name: 'Start live voice' })
  expect(live.hasAttribute('disabled')).toBe(true)
  fireEvent.click(live)
  expect(props.voice.startLive).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: 'Finish and send dictation', checked: true }))
  expect(props.onStopDictation).toHaveBeenCalledOnce()
  expect(props.onCancelDictation).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel dictation' }))
  expect(props.onCancelDictation).toHaveBeenCalledOnce()
})

it('keeps conversation viewing and microphone controls separate from switching Live to text', () => {
  const props = controls()
  props.voice.connection = 'live'
  props.voice.output = 'speaking'
  render(view(props))
  fireEvent.click(screen.getByRole('button', { name: 'Show conversation' }))
  expect(props.onShowChat).toHaveBeenCalledOnce()
  expect(props.onText).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Mute microphone' })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: 'Switch to text' }))
  expect(props.onText).toHaveBeenCalledOnce()
})

it('offers dictation and text for other agents and prevents voice overlap while stopping', () => {
  const props = controls({ codex: false })
  const { rerender } = render(view(props))
  expect(screen.queryByRole('radio', { name: 'Start live voice' })).toBeNull()
  expect(screen.getByRole('radio', { name: 'Dictate' }).hasAttribute('disabled')).toBe(false)
  props.voice.connection = 'stopping'
  rerender(view({ ...props, codex: true }))
  expect(screen.getByRole('radio', { name: 'Live voice on' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('radio', { name: 'Dictate' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: 'Dictate' }))
  expect(props.onDictate).not.toHaveBeenCalled()
})
