// @vitest-environment happy-dom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentHubOrbSpeechBubble } from './AgentHubOrbSpeechBubble'

vi.mock('./use-agent-hub-orb-caption-side', () => ({
  useAgentHubOrbCaptionSide: () => ({ side: 'right', sideOffset: 12 })
}))

function Caption({
  text,
  durationMs,
  action,
  hint
}: {
  text: string
  durationMs?: number
  action?: React.ReactNode
  hint?: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <TooltipProvider>
      <AgentHubOrbSpeechBubble
        open={open}
        onOpenChange={setOpen}
        text={text}
        speakerLabel="Orb"
        durationMs={durationMs}
        action={action}
        hint={hint}
      >
        <button>Live Orb</button>
      </AgentHubOrbSpeechBubble>
    </TooltipProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('hides idle speech after one minute and lets the pointer keep it available', () => {
  vi.useFakeTimers()
  render(<Caption text="Read this spoken response" />)
  const visible = () => screen.queryByText('Read this spoken response') !== null
  act(() => vi.advanceTimersByTime(59_999))
  expect(visible()).toBe(true)
  act(() => vi.advanceTimersByTime(1))
  expect(visible()).toBe(false)
  const orb = screen.getByRole('button', { name: 'Live Orb' })
  fireEvent.pointerEnter(orb)
  expect(visible()).toBe(true)
  act(() => vi.advanceTimersByTime(120_000))
  expect(visible()).toBe(true)
  fireEvent.pointerLeave(orb)
  act(() => vi.advanceTimersByTime(30_000))
  const bubble = screen
    .getByText('Read this spoken response')
    .closest('[data-agent-hub-orb-captions]')!
  fireEvent.pointerEnter(bubble)
  act(() => vi.advanceTimersByTime(120_000))
  expect(visible()).toBe(true)
  fireEvent.pointerLeave(bubble)
  act(() => vi.advanceTimersByTime(59_999))
  expect(visible()).toBe(true)
  act(() => vi.advanceTimersByTime(1))
  expect(visible()).toBe(false)
})

it('starts a fresh minute for new speech while preserving an explicit Close', () => {
  vi.useFakeTimers()
  const { rerender } = render(<Caption text="First response" />)
  act(() => vi.advanceTimersByTime(45_000))
  rerender(<Caption text="Second response" />)
  act(() => vi.advanceTimersByTime(45_000))
  expect(screen.queryByText('Second response')).not.toBeNull()
  act(() => vi.advanceTimersByTime(15_000))
  expect(screen.queryByText('Second response')).toBeNull()
  rerender(<Caption text="" />)
  rerender(<Caption text="Second response" />)
  expect(screen.queryByText('Second response')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  rerender(<Caption text="Third response" />)
  fireEvent.pointerEnter(screen.getByRole('button', { name: 'Live Orb' }))
  expect(screen.queryByText('Third response')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show captions' }))
  expect(screen.queryByText('Third response')).not.toBeNull()
})

it('lets captions expire again after the bubble closed under a resting pointer', () => {
  vi.useFakeTimers()
  render(<Caption text="Sticky response" />)
  const bubble = screen.getByText('Sticky response').closest('[data-agent-hub-orb-captions]')!
  fireEvent.pointerEnter(bubble)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: 'Show captions' }))
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.queryByText('Sticky response')).toBeNull()
})

it('offers Show captions after the idle timeout and restores them from the keyboard', () => {
  vi.useFakeTimers()
  render(<Caption text="Timed out response" />)
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.queryByText('Timed out response')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show captions' }))
  expect(screen.queryByText('Timed out response')).not.toBeNull()
})

it('keeps a written reply for its shorter time with its own header action', () => {
  vi.useFakeTimers()
  render(<Caption text="Tests passed" durationMs={12_000} action={<button>Open chat</button>} />)
  const header = screen.getByRole('button', { name: 'Open chat' }).parentElement
  expect(header?.contains(screen.getByRole('button', { name: 'Close' }))).toBe(true)
  act(() => vi.advanceTimersByTime(11_999))
  expect(screen.queryByText('Tests passed')).not.toBeNull()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByText('Tests passed')).toBeNull()
})

it('keeps a pending hint on the sphere without a reply until it is answered', () => {
  vi.useFakeTimers()
  const { rerender } = render(<Caption text="" hint={<p>Memory suggestion</p>} />)
  act(() => vi.advanceTimersByTime(30 * 60_000))
  expect(screen.queryByText('Memory suggestion')).not.toBeNull()
  rerender(<Caption text="" />)
  expect(screen.queryByText('Memory suggestion')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Show captions' })).toBeNull()
})
