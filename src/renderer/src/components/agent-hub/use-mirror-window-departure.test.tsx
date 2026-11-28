/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  closeAgentHubMirror,
  minimizeAgentHubMirror
} from './agent-hub-mirror-store'
import { addAgentHubMirrorTab, moveAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { useMirrorWindowDeparture } from './use-mirror-window-departure'

vi.mock('./agent-hub-mirror-source', () => ({
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function open(title: string) {
  const worktree = makeWorktree()
  openAgentHubMirror({
    worktree,
    repo: null,
    tab: makeTabWithIds(title, worktree.id),
    paneKey: null,
    title,
    agentType: null
  })
  return readAgentHubMirrors().windows.at(-1)!
}
it('invalidates a late minimize callback when membership moved to a different owner', () => {
  const source = open('a'),
    destination = open('b')
  const animation = { onfinish: () => {}, oncancel: () => {}, cancel: vi.fn() }
  const element = document.createElement('section')
  Object.defineProperty(element, 'animate', { value: () => animation })
  const { result, rerender } = renderHook(
    ({ membership }) =>
      useMirrorWindowDeparture(source.id, membership, { current: element }, { current: null }, () =>
        minimizeAgentHubMirror(source.id)
      ),
    { initialProps: { membership: source } }
  )
  act(() => result.current.minimize())
  act(() => moveAgentHubMirrorTab(source.id, source.tabs[0]!.id, destination.id, 0))
  rerender({ membership: source })
  const before = readAgentHubMirrors()
  act(() => animation.onfinish())
  expect(readAgentHubMirrors()).toBe(before)
  expect(readAgentHubMirrors().chips).toHaveLength(0)
})
it('cancels an old close token after membership changes and on unmount', () => {
  vi.useFakeTimers()
  const source = open('a')
  const { result, rerender, unmount } = renderHook(
    ({ membership }) =>
      useMirrorWindowDeparture(
        source.id,
        membership,
        { current: null },
        { current: null },
        vi.fn()
      ),
    { initialProps: { membership: source } }
  )
  act(() => result.current.leave(() => closeAgentHubMirror(source.id)))
  act(() =>
    addAgentHubMirrorTab(source.id, {
      ...source.tabs[0]!.target,
      tab: makeTabWithIds('b', source.tabs[0]!.target.worktree.id)
    })
  )
  rerender({ membership: readAgentHubMirrors().windows[0]! })
  act(() => vi.runAllTimers())
  expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
  act(() => result.current.leave(() => closeAgentHubMirror(source.id)))
  unmount()
  act(() => vi.runAllTimers())
  expect(readAgentHubMirrors().windows).toHaveLength(1)
})

it('parks immediately with reduced motion and never starts a flight animation', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })
  const source = open('reduced motion')
  const element = document.createElement('section')
  const animate = vi.fn()
  Object.defineProperty(element, 'animate', { value: animate })
  const { result } = renderHook(() =>
    useMirrorWindowDeparture(source.id, source, { current: element }, { current: null }, () =>
      minimizeAgentHubMirror(source.id)
    )
  )
  act(() => result.current.minimize(200))
  expect(readAgentHubMirrors().windows).toHaveLength(0)
  expect(readAgentHubMirrors().chips[0]?.window.id).toBe(source.id)
  expect(animate).not.toHaveBeenCalled()
})
