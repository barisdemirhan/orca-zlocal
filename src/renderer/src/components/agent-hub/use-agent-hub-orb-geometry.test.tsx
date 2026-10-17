// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAgentHubOrbGeometry } from './use-agent-hub-orb-geometry'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ settings: {} })) }
})

function Geometry({ embedded, compact }: { embedded: boolean; compact: boolean }) {
  const { geometry, resizeKey, beginGesture } = useAgentHubOrbGeometry({
    embedded,
    compact,
    requestVisible: false
  })
  return (
    <button
      onKeyDown={resizeKey}
      onPointerDown={(event) => beginGesture('resize', event)}
      aria-label="Resize Orb"
    >
      {geometry.diameter}
    </button>
  )
}
beforeEach(() => {
  useAgentHubOrbPanel.setState({ preferredDiameter: 280, stagePosition: { x: 24, y: 72 } })
})
afterEach(cleanup)

it.each([
  { embedded: true, compact: false },
  { embedded: false, compact: true }
])('preserves the preferred size when resize input reaches $embedded/$compact geometry', (mode) => {
  render(<Geometry {...mode} />)
  const resize = screen.getByRole('button', { name: 'Resize Orb' })
  resize.setPointerCapture = vi.fn()
  resize.hasPointerCapture = () => false
  for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight']) {
    fireEvent.keyDown(resize, { key })
  }
  fireEvent.pointerDown(resize, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 200 })
  fireEvent.pointerUp(window, { pointerId: 1 })
  expect(useAgentHubOrbPanel.getState().preferredDiameter).toBe(280)
  expect(resize.setPointerCapture).not.toHaveBeenCalled()
})

it('keeps floating keyboard resizing available after leaving compact mode', () => {
  const { rerender } = render(<Geometry embedded={false} compact />)
  rerender(<Geometry embedded={false} compact={false} />)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Resize Orb' }), { key: 'ArrowRight' })
  expect(useAgentHubOrbPanel.getState().preferredDiameter).toBe(288)
})
