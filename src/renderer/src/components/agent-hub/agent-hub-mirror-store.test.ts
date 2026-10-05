import { beforeEach, describe, expect, it } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  focusAgentHubMirror,
  keepAgentHubMirrorPlace,
  MAX_AGENT_HUB_MIRROR_WINDOWS,
  minimizeAgentHubMirror,
  minimizeAllAgentHubMirrors,
  openAgentHubMirror,
  openAgentHubMirrors,
  readAgentHubMirrorOrigin,
  readAgentHubMirrors,
  rememberAgentHubMirrorOrigin,
  resetAgentHubMirrorsForTest,
  restoreAgentHubMirror,
  restoreAgentHubMirrors,
  retargetAgentHubMirror
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

const windowKeys = (): string[] => readAgentHubMirrors().windows.map((open) => open.paneKey ?? '')
const chipKeys = (): string[] =>
  readAgentHubMirrors().chips.map((chip) => chip.target.paneKey ?? '')

describe('agent hub mirror store', () => {
  beforeEach(() => {
    resetAgentHubMirrorsForTest()
  })

  it('keeps several mirrors open and brings a reopened one to the front', () => {
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    openAgentHubMirror(target('tab-a'))

    expect(windowKeys()).toEqual(['tab-b:leaf', 'tab-a:leaf'])
    focusAgentHubMirror('tab-b:leaf')
    expect(windowKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf'])
  })

  it('shrinks the back-most window into a chip past the cap', () => {
    const tabs = Array.from({ length: MAX_AGENT_HUB_MIRROR_WINDOWS + 1 }, (_, i) => `tab-${i}`)
    for (const tabId of tabs) {
      openAgentHubMirror(target(tabId))
    }

    expect(readAgentHubMirrors().windows).toHaveLength(MAX_AGENT_HUB_MIRROR_WINDOWS)
    expect(chipKeys()).toEqual(['tab-0:leaf'])
  })

  it('parks every open window in the tray at once and brings the chosen ones back', () => {
    for (const tabId of ['tab-a', 'tab-b', 'tab-c']) {
      openAgentHubMirror(target(tabId))
    }
    minimizeAllAgentHubMirrors()

    expect(windowKeys()).toEqual([])
    expect(chipKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf', 'tab-c:leaf'])
    // The first key asked for ends up in front.
    restoreAgentHubMirrors(['tab-c:leaf', 'tab-a:leaf'])
    expect(windowKeys()).toEqual(['tab-a:leaf', 'tab-c:leaf'])
    expect(chipKeys()).toEqual(['tab-b:leaf'])
  })

  it('restores a chip as the front window and closes only the one asked', () => {
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror('tab-a:leaf')
    restoreAgentHubMirror('tab-a:leaf')

    expect(chipKeys()).toEqual([])
    expect(windowKeys()).toEqual(['tab-b:leaf', 'tab-a:leaf'])
    closeAgentHubMirror('tab-b:leaf')
    expect(windowKeys()).toEqual(['tab-a:leaf'])
  })

  it('switches a window to another pane in place, keeping its spot', () => {
    rememberAgentHubMirrorOrigin('tab-a:leaf', { x: 50, y: 60, width: 640, height: 400 })
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    retargetAgentHubMirror('tab-a:leaf', target('tab-c'))

    expect(windowKeys()).toEqual(['tab-c:leaf', 'tab-b:leaf'])
    expect(readAgentHubMirrorOrigin('tab-c:leaf')).toEqual({
      x: 50,
      y: 60,
      width: 640,
      height: 400
    })

    // A pane already in its own window is brought forward rather than opened twice.
    openAgentHubMirror(target('tab-c'))
    retargetAgentHubMirror('tab-b:leaf', target('tab-c'))
    expect(windowKeys()).toEqual(['tab-b:leaf', 'tab-c:leaf'])
  })

  it('forgets where a closed window stood unless the user put it there', () => {
    const place = { x: 50, y: 60, width: 640, height: 400 }
    openAgentHubMirror(target('tab-a'))
    rememberAgentHubMirrorOrigin('tab-a:leaf', place)
    // Parked and brought back, it returns to its place.
    minimizeAgentHubMirror('tab-a:leaf')
    restoreAgentHubMirror('tab-a:leaf')
    expect(readAgentHubMirrorOrigin('tab-a:leaf')).toEqual(place)
    closeAgentHubMirror('tab-a:leaf')
    expect(readAgentHubMirrorOrigin('tab-a:leaf')).toBeNull()

    openAgentHubMirror(target('tab-b'))
    rememberAgentHubMirrorOrigin('tab-b:leaf', place)
    keepAgentHubMirrorPlace('tab-b:leaf')
    minimizeAgentHubMirror('tab-b:leaf')
    closeAgentHubMirrorChip('tab-b:leaf')
    expect(readAgentHubMirrorOrigin('tab-b:leaf')).toEqual(place)
  })

  it('opens many panes at once: windows up to the cap, the first in front, the rest parked', () => {
    openAgentHubMirror(target('tab-old'))
    openAgentHubMirrors(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => target(`tab-${id}`)))

    expect(windowKeys()).toEqual(['tab-d:leaf', 'tab-c:leaf', 'tab-b:leaf', 'tab-a:leaf'])
    expect(chipKeys().toSorted()).toEqual(['tab-e:leaf', 'tab-f:leaf', 'tab-old:leaf'])
  })
})
