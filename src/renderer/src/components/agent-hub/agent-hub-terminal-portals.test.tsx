/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import {
  setActivityTerminalPortals,
  setAgentHubTerminalPortals,
  useActivityTerminalPortals,
  type ActivityTerminalPortalTarget
} from '../activity/activity-terminal-portal'

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
