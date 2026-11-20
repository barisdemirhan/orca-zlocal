/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import {
  setActivityTerminalPortals,
  setAgentHubTerminalPortals,
  useActivityTerminalPortals,
  findActivityTerminalPortal,
  type ActivityTerminalPortalTarget
} from '../activity/terminal-portal/activity-terminal-portal'
import { isTerminalSourceVisible } from '../terminal-pane/terminal-source-visibility'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

let root: Root | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  setActivityTerminalPortals([])
  setAgentHubTerminalPortals([])
})

function portal(slotId: string, tabId: string): ActivityTerminalPortalTarget {
  return {
    slotId,
    requestToken: `${slotId}:${tabId}:leaf`,
    target: document.createElement('div'),
    worktreeId: 'worktree-a',
    tabId,
    paneKey: `${tabId}:leaf`,
    active: true
  }
}

function renderPortals(activityOpen: boolean): () => readonly ActivityTerminalPortalTarget[] {
  let latest: readonly ActivityTerminalPortalTarget[] = []
  function Subscriber(): null {
    latest = useActivityTerminalPortals(activityOpen)
    return null
  }
  root = createRoot(document.createElement('div'))
  act(() => root?.render(<Subscriber />))
  return () => latest
}

describe('Agent Hub terminal portals', () => {
  it('gives Hub priority over Activity independently of array order or quiet activation', () => {
    const activity = portal('primary', 'tab-a')
    const hub: ActivityTerminalPortalTarget = {
      ...portal('agent-hub:tab-a', 'tab-a'),
      owner: 'agent-hub',
      active: false
    }
    for (const targets of [
      [activity, hub],
      [hub, activity]
    ]) {
      expect(
        findActivityTerminalPortal(targets, { worktreeId: 'worktree-a', tabId: 'tab-a' })
      ).toBe(hub)
      expect(
        findActivityTerminalPortal(targets, {
          worktreeId: 'worktree-a',
          tabId: 'tab-a',
          slotId: activity.slotId,
          requestToken: activity.requestToken
        })
      ).toBeNull()
      expect(
        findActivityTerminalPortal(targets, {
          worktreeId: 'worktree-a',
          tabId: 'tab-a',
          slotId: hub.slotId,
          requestToken: hub.requestToken
        })
      ).toBe(hub)
    }
  })

  it('keeps a source visible in an unfocused split group home, until canvas covers it', () => {
    const state: Parameters<typeof isTerminalSourceVisible>[0] = {
      activeView: 'terminal',
      activeWorktreeId: 'worktree-a',
      activeTabId: 'tab-b',
      activeTabType: 'terminal',
      groupsByWorktree: {
        'worktree-a': [
          { id: 'left', activeTabId: 'unified-a' },
          { id: 'right', activeTabId: 'unified-b' }
        ]
      },
      unifiedTabsByWorktree: {
        'worktree-a': [
          { id: 'unified-a', entityId: 'tab-a', contentType: 'terminal', groupId: 'left' },
          { id: 'unified-b', entityId: 'tab-b', contentType: 'terminal', groupId: 'right' }
        ]
      }
    }
    expect(isTerminalSourceVisible(state, 'worktree-a', 'tab-a', false)).toBe(true)
    expect(isTerminalSourceVisible(state, 'worktree-a', 'tab-a', true)).toBe(false)
  })
  it('keeps snapshots stable for concurrent Activity-open and closed subscribers', () => {
    setActivityTerminalPortals([portal('activity', 'tab-a')])
    setAgentHubTerminalPortals([portal('agent-hub', 'tab-b')])
    let inside: readonly ActivityTerminalPortalTarget[] = []
    let outside: readonly ActivityTerminalPortalTarget[] = []
    function Subscribers(): null {
      inside = useActivityTerminalPortals(true)
      outside = useActivityTerminalPortals(false)
      return null
    }
    root = createRoot(document.createElement('div'))
    act(() => root?.render(<Subscribers />))
    const initialInside = inside
    const initialOutside = outside
    act(() => root?.render(<Subscribers />))
    expect(inside).toBe(initialInside)
    expect(outside).toBe(initialOutside)
    expect(inside.map((entry) => entry.slotId)).toEqual(['activity', 'agent-hub'])
    expect(outside.map((entry) => entry.slotId)).toEqual(['agent-hub'])
  })

  it("move a mirrored pane in every view, and join Activity's slots while it is open", () => {
    setActivityTerminalPortals([portal('activity', 'tab-a')])
    const outsideActivity = renderPortals(false)
    expect(outsideActivity()).toEqual([])

    act(() => setAgentHubTerminalPortals([portal('agent-hub', 'tab-b')]))
    expect(outsideActivity().map((target) => target.slotId)).toEqual(['agent-hub'])

    act(() => root?.unmount())
    const insideActivity = renderPortals(true)
    expect(insideActivity().map((target) => target.slotId)).toEqual(['activity', 'agent-hub'])
  })
})
