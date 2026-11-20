import type * as MirrorSource from './agent-hub-mirror-source'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import { readAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import { readAgentHubMirrorOrigin, rememberAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import {
  closeAgentHubMirror,
  focusAgentHubMirror,
  minimizeAgentHubMirror,
  minimizeAllAgentHubMirrors,
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  toggleAgentHubMirrorFocus
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function target(tabId: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(tabId, worktree.id),
    paneKey: `${tabId}:leaf`,
    title: tabId,
    agentType: 'claude'
  }
}

const frontKey = (): string | null => readAgentHubMirrors().windows.at(-1)?.id ?? null

describe('agent hub mirror focus', () => {
  beforeEach(() => {
    resetAgentHubMirrorsForTest()
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    openAgentHubMirror(target('tab-c'))
  })

  it('brings the focused mirror to the front, and returns it on the second ask', () => {
    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))
    expect(readAgentHubMirrorFocus()).toBe(mirrorWindowIdFor('tab-a:leaf'))
    expect(frontKey()).toBe(mirrorWindowIdFor('tab-a:leaf'))

    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))
    expect(readAgentHubMirrorFocus()).toBeNull()
  })

  it('focuses one mirror at a time: focusing another takes the focus over', () => {
    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))
    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-b:leaf'))

    expect(readAgentHubMirrorFocus()).toBe(mirrorWindowIdFor('tab-b:leaf'))
    expect(frontKey()).toBe(mirrorWindowIdFor('tab-b:leaf'))
  })

  it('ignores a mirror that is not open in a window', () => {
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))

    expect(readAgentHubMirrorFocus()).toBeNull()
  })

  it("leaves the focused mirror's own place as it was", () => {
    const place = { x: 40, y: 60, width: 500, height: 320 }
    rememberAgentHubMirrorOrigin(mirrorWindowIdFor('tab-a:leaf'), place)

    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))
    expect(readAgentHubMirrorOrigin(mirrorWindowIdFor('tab-a:leaf'))).toBe(place)

    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))
    expect(readAgentHubMirrorOrigin(mirrorWindowIdFor('tab-a:leaf'))).toBe(place)
  })

  it.each([
    ['minimizing it', () => minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))],
    ['closing it', () => closeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))],
    ['sending every mirror to the tray', () => minimizeAllAgentHubMirrors()],
    ['another mirror coming forward', () => focusAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))],
    ['another mirror opening', () => openAgentHubMirror(target('tab-d'))]
  ])('ends the focus on %s', (_, act) => {
    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))

    act()

    expect(readAgentHubMirrorFocus()).toBeNull()
  })

  it('keeps the focus when a mirror behind it closes', () => {
    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a:leaf'))

    closeAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))

    expect(readAgentHubMirrorFocus()).toBe(mirrorWindowIdFor('tab-a:leaf'))
  })
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))
