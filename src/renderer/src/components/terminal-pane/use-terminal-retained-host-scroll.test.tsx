/** @vitest-environment happy-dom */
import { render, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import {
  RetainedPaneMoveContext,
  moveRetainedPaneContent,
  type RetainedPaneMoveParticipant
} from '../tab-group/retained-pane-move'
import { useTerminalRetainedHostScroll } from './use-terminal-retained-host-scroll'

const scroll = vi.hoisted(() => ({ capture: vi.fn(), restore: vi.fn() }))
vi.mock('@/lib/pane-manager/terminal-scroll/pane-scroll', () => ({
  captureScrollState: scroll.capture,
  restoreScrollStateAfterLayout: scroll.restore
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('captures content before reparenting and restores through the existing layout path after it moves', () => {
  const home = document.createElement('div')
  const mirror = document.createElement('div')
  const container = document.createElement('div')
  home.appendChild(container)
  const participants = new Set<RetainedPaneMoveParticipant>()
  const terminal = { origin: 'same terminal' }
  const marker = { viewportY: 31, wasAtBottom: false }
  scroll.capture.mockImplementation(() => {
    expect(container.parentElement).toBe(home)
    return marker
  })
  scroll.restore.mockImplementation(() => {
    expect(container.parentElement).toBe(mirror)
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this hook only reads getPanes and forwards the terminal to the mocked scroll boundary.
  const manager = { getPanes: () => [{ terminal }] } as unknown as PaneManager
  function Owner(): null {
    useTerminalRetainedHostScroll({ current: manager })
    return null
  }
  const view = render(
    <RetainedPaneMoveContext value={participants}>
      <Owner />
    </RetainedPaneMoveContext>
  )
  moveRetainedPaneContent(container, mirror, participants)
  expect(scroll.capture).toHaveBeenCalledWith(terminal)
  expect(scroll.restore).toHaveBeenCalledWith(terminal, marker)
  moveRetainedPaneContent(container, mirror, participants)
  expect(scroll.capture).toHaveBeenCalledOnce()
  view.unmount()
  expect(participants.size).toBe(0)
})
