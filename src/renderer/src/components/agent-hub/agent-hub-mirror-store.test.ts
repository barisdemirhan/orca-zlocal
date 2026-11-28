import type * as MirrorSource from './agent-hub-mirror-source'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import {
  keepAgentHubMirrorPlace,
  readAgentHubMirrorOrigin,
  rememberAgentHubMirrorOrigin
} from './agent-hub-mirror-places'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  focusAgentHubMirror,
  isAgentHubMirrorStageQuiet,
  reopenAgentHubMirrors,
  agentHubMirrorWindowCap,
  setAgentHubMirrorWindowCap,
  minimizeAgentHubMirror,
  minimizeAllAgentHubMirrors,
  openAgentHubMirror,
  openAgentHubMirrors,
  pruneClosedAgentHubMirrorSources,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  restoreAgentHubMirror,
  restoreAgentHubMirrors
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAppStore } from '@/store'

vi.mock('sonner', () => ({ toast: { message: vi.fn() } }))

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

const windowKeys = (): string[] =>
  readAgentHubMirrors().windows.map((open) => activeAgentHubMirrorTab(open).target.paneKey ?? '')
const chipKeys = (): string[] =>
  readAgentHubMirrors().chips.map(
    (chip) => activeAgentHubMirrorTab(chip.window).target.paneKey ?? ''
  )

describe('agent hub mirror store', () => {
  beforeEach(() => {
    resetAgentHubMirrorsForTest()
  })

  it('keeps several mirrors open and brings a reopened one to the front', () => {
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    openAgentHubMirror(target('tab-a'))

    expect(windowKeys()).toEqual(['tab-b:leaf', 'tab-a:leaf'])
    focusAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))
    expect(windowKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf'])
  })

  it('shrinks the back-most window into a chip past the cap', () => {
    const tabs = Array.from({ length: agentHubMirrorWindowCap() + 1 }, (_, i) => `tab-${i}`)
    for (const tabId of tabs) {
      openAgentHubMirror(target(tabId))
    }

    expect(readAgentHubMirrors().windows).toHaveLength(agentHubMirrorWindowCap())
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
    restoreAgentHubMirrors(['tab-c:leaf', 'tab-a:leaf'].map(mirrorWindowIdFor))
    expect(windowKeys()).toEqual(['tab-a:leaf', 'tab-c:leaf'])
    expect(chipKeys()).toEqual(['tab-b:leaf'])
  })

  it('restores a chip as the front window and closes only the one asked', () => {
    openAgentHubMirror(target('tab-a'))
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
    restoreAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))

    expect(chipKeys()).toEqual([])
    expect(windowKeys()).toEqual(['tab-b:leaf', 'tab-a:leaf'])
    closeAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))
    expect(windowKeys()).toEqual(['tab-a:leaf'])
  })

  it('forgets where a closed window stood unless the user put it there', () => {
    const place = { x: 50, y: 60, width: 640, height: 400 }
    openAgentHubMirror(target('tab-a'))
    const aId = mirrorWindowIdFor('tab-a:leaf')
    rememberAgentHubMirrorOrigin(aId, place)
    // Parked and brought back, it returns to its place.
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
    restoreAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
    expect(readAgentHubMirrorOrigin(aId)).toEqual(place)
    closeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
    expect(readAgentHubMirrorOrigin(aId)).toBeNull()

    openAgentHubMirror(target('tab-b'))
    const bId = mirrorWindowIdFor('tab-b:leaf')
    rememberAgentHubMirrorOrigin(bId, place)
    keepAgentHubMirrorPlace(mirrorWindowIdFor('tab-b:leaf'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))
    closeAgentHubMirrorChip(mirrorWindowIdFor('tab-b:leaf'))
    expect(readAgentHubMirrorOrigin(bId)).toBeNull()
    openAgentHubMirror(target('tab-b'))
    expect(mirrorWindowIdFor('tab-b:leaf')).not.toBe(bId)
    expect(readAgentHubMirrorOrigin(mirrorWindowIdFor('tab-b:leaf'))).toEqual(place)
  })

  it('reopens a source at its chosen place with a new window identity', () => {
    const place = { x: 80, y: 90, width: 500, height: 320 }
    openAgentHubMirror(target('tab-a'))
    const firstId = mirrorWindowIdFor('tab-a:leaf')
    rememberAgentHubMirrorOrigin(firstId, place)
    keepAgentHubMirrorPlace(firstId)
    closeAgentHubMirror(firstId)
    openAgentHubMirror(target('tab-a'))
    const nextId = mirrorWindowIdFor('tab-a:leaf')
    expect(nextId).not.toBe(firstId)
    expect(readAgentHubMirrorOrigin(nextId)).toEqual(place)
  })

  it('opens many panes at once: windows up to the cap, the first in front, the rest parked', () => {
    openAgentHubMirror(target('tab-old'))
    openAgentHubMirrors(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => target(`tab-${id}`)))

    expect(windowKeys()).toEqual(['tab-d:leaf', 'tab-c:leaf', 'tab-b:leaf', 'tab-a:leaf'])
    expect(chipKeys().toSorted()).toEqual(['tab-e:leaf', 'tab-f:leaf', 'tab-old:leaf'])
  })

  it('minimizes a pane into the tray, and takes a tab back out of it', () => {
    openAgentHubMirror(target('tab-open'))
    openAgentHubMirror(target('tab-a'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))
    expect(windowKeys()).toEqual(['tab-open:leaf'])
    expect(chipKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf'])

    openAgentHubMirror(target('tab-a'))
    expect(windowKeys()).toEqual(['tab-open:leaf', 'tab-a:leaf'])
    expect(chipKeys()).toEqual(['tab-b:leaf'])
  })

  it('reports the oldest chip the tray drops when minimizing past its cap', () => {
    vi.mocked(toast.message).mockClear()
    for (let index = 0; index < 12; index += 1) {
      openAgentHubMirror(target(`tab-${index}`))
      minimizeAgentHubMirror(mirrorWindowIdFor(`tab-${index}:leaf`))
    }
    expect(toast.message).not.toHaveBeenCalled()

    openAgentHubMirror(target('tab-12'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-12:leaf'))
    expect(chipKeys()).toHaveLength(12)
    expect(chipKeys()).not.toContain('tab-0:leaf')
    expect(toast.message).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.message).mock.calls[0][0]).toContain('oldest minimized mirror')
  })

  it('drops a closed source from windows and chips, and keeps one whose workspace is unknown', () => {
    openAgentHubMirror(target('tab-open'))
    openAgentHubMirror(target('tab-a'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
    openAgentHubMirror(target('tab-b'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))
    const worktreeId = target('tab-a').worktree.id

    useAppStore.setState({ tabsByWorktree: {} })
    pruneClosedAgentHubMirrorSources()
    expect(windowKeys()).toEqual(['tab-open:leaf'])
    expect(chipKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf'])

    useAppStore.setState({
      tabsByWorktree: { [worktreeId]: [makeTabWithIds('tab-b', worktreeId)] }
    })
    pruneClosedAgentHubMirrorSources()
    expect(windowKeys()).toEqual([])
    expect(chipKeys()).toEqual(['tab-b:leaf'])
  })

  it('parks the oldest windows when the cap is lowered, and allows more when it is raised', () => {
    for (const id of ['tab-a', 'tab-b', 'tab-c']) {
      openAgentHubMirror(target(id))
    }
    setAgentHubMirrorWindowCap(2)
    expect(
      readAgentHubMirrors().windows.map((window) => activeAgentHubMirrorTab(window).target.tab.id)
    ).toEqual(['tab-b', 'tab-c'])
    expect(
      readAgentHubMirrors().chips.map((chip) => activeAgentHubMirrorTab(chip.window).target.tab.id)
    ).toEqual(['tab-a'])
    setAgentHubMirrorWindowCap(6)
    for (const id of ['tab-d', 'tab-e', 'tab-f', 'tab-g']) {
      openAgentHubMirror(target(id))
    }
    expect(readAgentHubMirrors().windows).toHaveLength(6)
  })

  describe('putting back the mirrors of the last session', () => {
    const reopened = (tabId: string, minimized = false) => ({
      window: {
        id: `saved-${tabId}`,
        tabs: [{ id: `entry-${tabId}`, target: target(tabId), origin: 'manual' as const }],
        activeTabId: `entry-${tabId}`
      },
      minimized,
      minimizedAt: 1,
      place: { geometry: { x: 10, y: 20, width: 640, height: 400 }, kept: true }
    })

    it('opens windows back to front and parks the chips, each at its place', () => {
      reopenAgentHubMirrors([reopened('tab-p', true), reopened('tab-a'), reopened('tab-b')])

      expect(windowKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf'])
      expect(chipKeys()).toEqual(['tab-p:leaf'])
      const bId = mirrorWindowIdFor('tab-b:leaf')
      expect(readAgentHubMirrorOrigin(bId)).toEqual({
        x: 10,
        y: 20,
        width: 640,
        height: 400
      })
      // Its place was the user's: it outlives closing the mirror.
      closeAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))
      expect(readAgentHubMirrorOrigin(bId)).toBeNull()
      openAgentHubMirror(target('tab-b'))
      expect(readAgentHubMirrorOrigin(mirrorWindowIdFor('tab-b:leaf'))).toEqual({
        x: 10,
        y: 20,
        width: 640,
        height: 400
      })
    })

    it('parks the back-most windows past a lowered cap', () => {
      setAgentHubMirrorWindowCap(2)
      reopenAgentHubMirrors(['tab-a', 'tab-b', 'tab-c', 'tab-d'].map((tabId) => reopened(tabId)))

      expect(windowKeys()).toEqual(['tab-c:leaf', 'tab-d:leaf'])
      expect(chipKeys()).toEqual(['tab-a:leaf', 'tab-b:leaf'])
    })

    it('stays quiet until the user picks a mirror', () => {
      reopenAgentHubMirrors([reopened('tab-a'), reopened('tab-b')])
      expect(isAgentHubMirrorStageQuiet()).toBe(true)

      // Parking or closing one is not picking one.
      minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
      expect(isAgentHubMirrorStageQuiet()).toBe(true)

      focusAgentHubMirror(mirrorWindowIdFor('tab-b:leaf'))
      expect(isAgentHubMirrorStageQuiet()).toBe(false)
    })

    it('goes behind mirrors opened since launch, which keep the keyboard', () => {
      openAgentHubMirror(target('tab-new'))
      reopenAgentHubMirrors([reopened('tab-a'), reopened('tab-new')])

      expect(windowKeys()).toEqual(['tab-a:leaf', 'tab-new:leaf'])
      expect(isAgentHubMirrorStageQuiet()).toBe(false)
    })
  })
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))
