// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { useAgentHubOrbGeometry } from './use-agent-hub-orb-geometry'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { createGlobalSettingsFixture } =
    await import('../../../../shared/global-settings-test-fixture')
  const useAppStore = create(() => ({
    settings: createGlobalSettingsFixture(),
    updateSettings: vi.fn((updates: Partial<GlobalSettings>) => {
      useAppStore.setState((state) => ({ settings: { ...state.settings, ...updates } }))
    })
  }))
  return { useAppStore }
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
      style={{ left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }}
    >
      {geometry.diameter}
    </button>
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ settings: createGlobalSettingsFixture() })
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
  expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
})

it('keeps floating keyboard resizing available after leaving compact mode', () => {
  const { rerender } = render(<Geometry embedded={false} compact />)
  rerender(<Geometry embedded={false} compact={false} />)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Resize Orb' }), { key: 'ArrowRight' })
  expect(useAgentHubOrbPanel.getState().preferredDiameter).toBe(288)
})

it.each([
  { current: 128, saved: 304, expected: 304 },
  { current: 280, saved: 304, expected: 280 },
  { current: 128, saved: 999, expected: 360 },
  { current: 128, saved: Number.NaN, expected: 128 }
])(
  'restores saved size $saved while preserving explicit size $current',
  ({ current, saved, expected }) => {
    useAppStore.setState({ settings: createGlobalSettingsFixture({ agentHubOrbDiameter: saved }) })
    useAgentHubOrbPanel.setState({ preferredDiameter: current })
    render(<Geometry embedded={false} compact={false} />)
    expect(useAgentHubOrbPanel.getState().preferredDiameter).toBe(expected)
    expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
  }
)

it('remembers a keyboard resize across Orb geometry remounts', () => {
  const { unmount } = render(<Geometry embedded={false} compact={false} />)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Resize Orb' }), { key: 'ArrowRight' })
  expect(useAppStore.getState().settings?.agentHubOrbDiameter).toBe(288)
  unmount()
  useAgentHubOrbPanel.setState({
    preferredDiameter: useAgentHubOrbPanel.getInitialState().preferredDiameter
  })
  render(<Geometry embedded={false} compact={false} />)
  expect(screen.getByRole('button', { name: 'Resize Orb' }).textContent).toBe('288')
})

it.each(['pointerup', 'pointercancel', 'blur'] as const)(
  'stores a pointer resize only on completion, ending with %s',
  (ending) => {
    useAppStore.setState({ settings: createGlobalSettingsFixture({ agentHubOrbDiameter: 280 }) })
    render(<Geometry embedded={false} compact={false} />)
    const resize = screen.getByRole('button', { name: 'Resize Orb' })
    resize.setPointerCapture = vi.fn()
    resize.hasPointerCapture = () => false
    fireEvent.pointerDown(resize, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 140, clientY: 140 })
    expect(useAgentHubOrbPanel.getState().preferredDiameter).toBe(320)
    expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
    if (ending === 'blur') {
      fireEvent.blur(window)
    } else if (ending === 'pointercancel') {
      fireEvent.pointerCancel(window, { pointerId: 1 })
    } else {
      fireEvent.pointerUp(window, { pointerId: 1 })
    }
    const expected = ending === 'pointerup' ? 320 : 280
    expect(useAgentHubOrbPanel.getState().preferredDiameter).toBe(expected)
    expect(useAppStore.getState().settings?.agentHubOrbDiameter).toBe(expected)
    expect(useAppStore.getState().updateSettings).toHaveBeenCalledTimes(
      ending === 'pointerup' ? 1 : 0
    )
  }
)
