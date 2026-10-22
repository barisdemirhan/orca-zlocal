// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  AGENT_HUB_ORB_DOUBLE_CLICK_MS,
  AGENT_HUB_ORB_HOLD_MS,
  useAgentHubOrbSphereGestures
} from './use-agent-hub-orb-sphere-gestures'

const handlers = {
  onClick: vi.fn(),
  onDoubleClick: vi.fn(),
  onHoldStart: vi.fn(),
  onHoldEnd: vi.fn()
}
const pointer = (x: number, y = 0) => ({ button: 0, clientX: x, clientY: y })

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

it('tells a click from a double click by waiting out the second press', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useAgentHubOrbSphereGestures(handlers, true))
  act(() => {
    result.current.onPointerDown(pointer(0))
    result.current.onPointerUp()
    result.current.onClick()
  })
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_DOUBLE_CLICK_MS - 1))
  expect(handlers.onClick).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(handlers.onClick).toHaveBeenCalledOnce()
  act(() => {
    result.current.onPointerDown(pointer(0))
    result.current.onPointerUp()
    result.current.onClick()
    result.current.onPointerDown(pointer(0))
    result.current.onPointerUp()
    result.current.onClick()
  })
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_DOUBLE_CLICK_MS))
  expect(handlers.onDoubleClick).toHaveBeenCalledOnce()
  expect(handlers.onClick).toHaveBeenCalledOnce()
})

it('turns a still press into a hold that ends on release without clicking', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useAgentHubOrbSphereGestures(handlers, true))
  act(() => result.current.onPointerDown(pointer(0)))
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_HOLD_MS))
  expect(handlers.onHoldStart).toHaveBeenCalledOnce()
  act(() => {
    result.current.onPointerUp()
    result.current.onClick()
  })
  expect(handlers.onHoldEnd).toHaveBeenCalledOnce()
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_DOUBLE_CLICK_MS))
  expect(handlers.onClick).not.toHaveBeenCalled()
})

it('lets a drag cancel both the hold and the click', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useAgentHubOrbSphereGestures(handlers, true))
  act(() => {
    result.current.onPointerDown(pointer(0))
    result.current.onPointerMove(pointer(12))
  })
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_HOLD_MS))
  act(() => {
    result.current.onPointerUp()
    result.current.onClick()
  })
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_DOUBLE_CLICK_MS))
  expect(handlers.onHoldStart).not.toHaveBeenCalled()
  expect(handlers.onClick).not.toHaveBeenCalled()
})
