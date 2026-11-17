/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { DragEndEvent } from '@dnd-kit/core'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as DragPassthrough from '../browser-pane/host-guest/drag/webview-drag-passthrough'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  minimizeAgentHubMirror
} from './agent-hub-mirror-store'
import { mirrorTabDragData } from './agent-hub-mirror-drag-data'
import {
  claimAgentHubMirrorGesture,
  agentHubMirrorGestureOwner,
  releaseAgentHubMirrorGesture
} from './agent-hub-mirror-gesture'
import { useAgentHubMirrorTabDrag } from './use-agent-hub-mirror-tab-drag'
import {
  endAgentHubMirrorFocus,
  isAgentHubMirrorFocusEscape,
  readAgentHubMirrorFocus,
  setAgentHubMirrorFocus
} from './agent-hub-mirror-focus'

const lease = vi.hoisted(() => ({ acquire: vi.fn(), release: vi.fn() }))
vi.mock('../browser-pane/host-guest/drag/webview-drag-passthrough', async (original) => ({
  ...(await original<typeof DragPassthrough>()),
  acquireWebviewsDragPassthrough: () => {
    lease.acquire()
    return lease.release
  }
}))
vi.mock('./agent-hub-mirror-source', () => ({
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  releaseAgentHubMirrorGesture('tab')
  endAgentHubMirrorFocus()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
function event(): DragEndEvent {
  const worktree = makeWorktree()
  openAgentHubMirror({
    worktree,
    repo: null,
    tab: makeTabWithIds('drag', worktree.id),
    title: 'drag',
    paneKey: null,
    agentType: null
  })
  const window = readAgentHubMirrors().windows[0]!
  const payload = mirrorTabDragData(window.id, window.tabs[0]!)
  claimAgentHubMirrorGesture('tab', 1)
  return {
    active: {
      id: payload.entryId,
      data: { current: payload },
      rect: { current: { initial: null, translated: null } }
    },
    activatorEvent: new MouseEvent('pointerdown', { clientX: 20, clientY: 30 }),
    delta: { x: 40, y: 0 },
    collisions: null,
    over: null
  }
}
it.each([
  'Escape',
  'lostpointercapture',
  'pointercancel',
  'missed-end',
  'blur',
  'modal',
  'unmount',
  'disable',
  'park'
] as const)('cancels %s without a membership commit and releases every lease', async (reason) => {
  const dragEvent = event()
  const { result, rerender, unmount } = renderHook(
    ({ enabled }) => useAgentHubMirrorTabDrag(enabled),
    { initialProps: { enabled: true } }
  )
  act(() => result.current.onDragStart(dragEvent))
  expect(result.current.active).not.toBeNull()
  const before = readAgentHubMirrors()
  if (reason === 'Escape') {
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
    )
  } else if (reason === 'lostpointercapture') {
    act(() => document.dispatchEvent(new Event('lostpointercapture')))
  } else if (reason === 'pointercancel') {
    act(() => result.current.onDragCancel())
  } else if (reason === 'missed-end' || reason === 'blur') {
    act(() => window.dispatchEvent(new Event(reason === 'blur' ? 'blur' : 'pointerup')))
    await act(() => new Promise((resolve) => setTimeout(resolve, 5)))
  } else if (reason === 'modal') {
    const overlay = document.createElement('div')
    overlay.dataset.slot = 'dialog-overlay'
    await act(async () => {
      document.body.append(overlay)
    })
    overlay.remove()
  } else if (reason === 'unmount') {
    unmount()
  } else if (reason === 'disable') {
    rerender({ enabled: false })
  } else {
    act(() => minimizeAgentHubMirror(before.windows[0]!.id))
  }
  if (reason !== 'unmount') {
    expect(result.current.active).toBeNull()
    act(() => result.current.onDragEnd(dragEvent))
  }
  if (reason !== 'park') {
    expect(readAgentHubMirrors()).toBe(before)
  } else {
    expect(readAgentHubMirrors().chips[0]?.window.tabs).toEqual(before.windows[0]!.tabs)
  }
  expect(lease.acquire).toHaveBeenCalledTimes(1)
  expect(lease.release).toHaveBeenCalledTimes(1)
  expect(agentHubMirrorGestureOwner()).toBeNull()
})

it('suppresses the delayed pointer click after Escape until a new intentional gesture', () => {
  const dragEvent = event()
  const { result } = renderHook(() => useAgentHubMirrorTabDrag(true))
  const clicked = vi.fn()
  const button = document.createElement('button')
  button.addEventListener('click', clicked)
  document.body.append(button)
  act(() => result.current.onDragStart(dragEvent))
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  const click = new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true })
  button.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  expect(clicked).not.toHaveBeenCalled()
  button.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }))
  expect(clicked).toHaveBeenCalledTimes(1)
  button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  button.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }))
  expect(clicked).toHaveBeenCalledTimes(2)
  button.remove()
})

it('gives Escape to the drag before the canvas focus handler', () => {
  const dragEvent = event()
  const { result } = renderHook(() => useAgentHubMirrorTabDrag(true))
  setAgentHubMirrorFocus('focused-window')
  const canvasEscape = (event: KeyboardEvent): void => {
    if (isAgentHubMirrorFocusEscape(event)) {
      endAgentHubMirrorFocus()
    }
  }
  window.addEventListener('keydown', canvasEscape, true)
  try {
    act(() => result.current.onDragStart(dragEvent))
    act(() =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
    )
    expect(result.current.active).toBeNull()
    expect(readAgentHubMirrorFocus()).toBe('focused-window')
  } finally {
    window.removeEventListener('keydown', canvasEscape, true)
  }
})
