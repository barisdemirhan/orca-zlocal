import { beforeEach, describe, expect, it } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
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
  retargetAgentHubMirror,
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

const frontKey = (): string | null => readAgentHubMirrors().windows.at(-1)?.paneKey ?? null

describe('agent hub mirror focus', () => {
  beforeEach(() => {
    resetAgentHubMirrorsForTest()
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    openAgentHubMirror(target('tab-c'))
  })

  it('brings the focused mirror to the front, and returns it on the second ask', () => {
    toggleAgentHubMirrorFocus('tab-a:leaf')
    expect(readAgentHubMirrorFocus()).toBe('tab-a:leaf')
    expect(frontKey()).toBe('tab-a:leaf')

    toggleAgentHubMirrorFocus('tab-a:leaf')
    expect(readAgentHubMirrorFocus()).toBeNull()
  })

  it('focuses one mirror at a time: focusing another takes the focus over', () => {
    toggleAgentHubMirrorFocus('tab-a:leaf')
    toggleAgentHubMirrorFocus('tab-b:leaf')

    expect(readAgentHubMirrorFocus()).toBe('tab-b:leaf')
    expect(frontKey()).toBe('tab-b:leaf')
  })

  it('ignores a mirror that is not open in a window', () => {
    minimizeAgentHubMirror('tab-a:leaf')
    toggleAgentHubMirrorFocus('tab-a:leaf')

    expect(readAgentHubMirrorFocus()).toBeNull()
  })

  it("leaves the focused mirror's own place as it was", () => {
    const place = { x: 40, y: 60, width: 500, height: 320 }
    rememberAgentHubMirrorOrigin('tab-a:leaf', place)

    toggleAgentHubMirrorFocus('tab-a:leaf')
    expect(readAgentHubMirrorOrigin('tab-a:leaf')).toBe(place)

    toggleAgentHubMirrorFocus('tab-a:leaf')
    expect(readAgentHubMirrorOrigin('tab-a:leaf')).toBe(place)
  })

  it.each([
    ['minimizing it', () => minimizeAgentHubMirror('tab-a:leaf')],
    ['closing it', () => closeAgentHubMirror('tab-a:leaf')],
    ['sending every mirror to the tray', () => minimizeAllAgentHubMirrors()],
    ['another mirror coming forward', () => focusAgentHubMirror('tab-b:leaf')],
    ['another mirror opening', () => openAgentHubMirror(target('tab-d'))]
  ])('ends the focus on %s', (_, act) => {
    toggleAgentHubMirrorFocus('tab-a:leaf')

    act()

    expect(readAgentHubMirrorFocus()).toBeNull()
  })

  it('keeps the focus when a mirror behind it closes', () => {
    toggleAgentHubMirrorFocus('tab-a:leaf')

    closeAgentHubMirror('tab-b:leaf')

    expect(readAgentHubMirrorFocus()).toBe('tab-a:leaf')
  })

  it('follows the focused window to the pane it switches to', () => {
    toggleAgentHubMirrorFocus('tab-a:leaf')

    retargetAgentHubMirror('tab-a:leaf', target('tab-e'))

    expect(readAgentHubMirrorFocus()).toBe('tab-e:leaf')
  })
})
