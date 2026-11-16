/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as MirrorSource from './agent-hub-mirror-source'
import {
  removeAgentHubMirrorEntries,
  agentHubMirrorSourceKey,
  agentHubMirrorWindows,
  findAgentHubMirrorMembership
} from './agent-hub-mirror-membership'
import {
  addAgentHubMirrorTab,
  activateAgentHubMirrorTab,
  closeAgentHubMirrorTab,
  reorderAgentHubMirrorTabs,
  moveAgentHubMirrorTab,
  detachAgentHubMirrorTab,
  toggleAgentHubMirrorTabPin
} from './agent-hub-mirror-tab-operations'
import {
  commitAgentHubMirrorState,
  openAgentHubMirror,
  openAgentHubMirrors,
  minimizeAgentHubMirror,
  restoreAgentHubMirror,
  setAgentHubMirrorWindowCap,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  subscribeAgentHubMirrors,
  toggleAgentHubMirrorFocus,
  reopenAgentHubMirrors
} from './agent-hub-mirror-store'
import { toggleAgentHubMirrorViewing } from './agent-hub-mirror-viewing'
import { readAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import { rememberAgentHubMirrorOrigin, readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import { captureAgentHubSession } from './agent-hub-session-restore'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'

const { disappeared } = vi.hoisted(() => ({ disappeared: new Set<string>() }))
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) =>
    disappeared.has(target.tab.id) ? null : target
}))
const target = (id: string, paneKey: string | null = null): AgentHubPaneTarget => {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(id, worktree.id),
    paneKey,
    title: id,
    agentType: null
  }
}
const owner = (id: string) => {
  const member = findAgentHubMirrorMembership(readAgentHubMirrors(), target(id))
  if (!member) {
    throw new Error(`Missing ${id}`)
  }
  return member
}
function expectInvariants(): void {
  const { windows, chips } = readAgentHubMirrors()
  const all = agentHubMirrorWindows({ windows, chips })
  expect(new Set(all.map((window) => window.id)).size).toBe(all.length)
  const entries = all.flatMap((window) => window.tabs)
  expect(new Set(entries.map((tab) => tab.id)).size).toBe(entries.length)
  expect(new Set(entries.map((tab) => agentHubMirrorSourceKey(tab.target))).size).toBe(
    entries.length
  )
  expect(entries.length).toBeLessThanOrEqual(256)
  for (const window of all) {
    expect(window.tabs.length).toBeGreaterThan(0)
    expect(window.tabs.length).toBeLessThanOrEqual(10)
    expect(window.tabs.some((tab) => tab.id === window.activeTabId)).toBe(true)
  }
}
beforeEach(() => {
  resetAgentHubMirrorsForTest()
  disappeared.clear()
})

describe('toggleAgentHubMirrorViewing', () => {
  it('shows a worker while keeping home and the tab count', () => {
    openAgentHubMirror(target('a'))
    const window = readAgentHubMirrors().windows[0]
    const tabId = window?.activeTabId ?? ''
    expect(toggleAgentHubMirrorViewing(window?.id ?? '', tabId, target('b')).status).toBe('changed')
    const next = readAgentHubMirrors().windows[0]
    expect(next?.tabs.map((tab) => tab.id)).toEqual([tabId])
    expect(next?.tabs[0]?.target.title).toBe('a')
    expect(next?.tabs[0]?.viewing?.title).toBe('b')
    expectInvariants()
  })
  it('views another split pane without changing the home leaf', () => {
    openAgentHubMirror(target('a', 'pane-1'))
    const window = readAgentHubMirrors().windows[0]
    expect(
      toggleAgentHubMirrorViewing(
        window?.id ?? '',
        window?.activeTabId ?? '',
        target('a', 'pane-2')
      ).status
    ).toBe('changed')
    expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.paneKey).toBe('pane-1')
    expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing?.paneKey).toBe('pane-2')
  })
  it('refuses a terminal another tab already owns', () => {
    openAgentHubMirror(target('a'))
    openAgentHubMirror(target('b'))
    const window = readAgentHubMirrors().windows[0]
    expect(
      toggleAgentHubMirrorViewing(window?.id ?? '', window?.activeTabId ?? '', target('b')).status
    ).toBe('already-owned')
    expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.title).toBe('a')
  })
  it('reports a vanished source without changing the tab', () => {
    openAgentHubMirror(target('a'))
    const window = readAgentHubMirrors().windows[0]
    disappeared.add('gone')
    expect(
      toggleAgentHubMirrorViewing(window?.id ?? '', window?.activeTabId ?? '', target('gone'))
        .status
    ).toBe('missing-source')
    expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.title).toBe('a')
  })
})

describe('mirror container membership', () => {
  it('adds mixed-workspace entries and pop-out selects an inactive member in the same stable window', () => {
    openAgentHubMirror(target('a'))
    const original = owner('a')
    const b = target('b')
    b.worktree = { ...b.worktree, id: 'folder-workspace' }
    expect(addAgentHubMirrorTab(original.window.id, b).status).toBe('changed')
    expect(addAgentHubMirrorTab(original.window.id, target('a')).status).toBe('already-owned')
    openAgentHubMirror(target('a', 'a:requested-leaf'))
    expect(owner('a').window.id).toBe(original.window.id)
    expect(owner('a').tab.id).toBe(original.tab.id)
    expect(owner('a').tab.target.paneKey).toBe('a:requested-leaf')
    expect(owner('a').window.activeTabId).toBe(original.tab.id)
    expectInvariants()
  })
  it('a split source is reserved by one entry across all leaves, open and parked', () => {
    openAgentHubMirror(target('a', 'a:leaf-one'))
    const original = owner('a')
    minimizeAgentHubMirror(original.window.id)
    openAgentHubMirror(target('a', 'a:leaf-two'))
    expect(owner('a').window.id).toBe(original.window.id)
    expect(owner('a').tab.id).toBe(original.tab.id)
    expect(readAgentHubMirrors().chips).toHaveLength(0)
    expect(readAgentHubMirrors().windows).toHaveLength(1)
    expectInvariants()
  })
  it('keeps host-qualified ownership separate even for equal workspace and tab ids', () => {
    const local = target('a')
    local.worktree = { ...local.worktree, hostId: 'local' }
    const remote = target('a')
    remote.worktree = { ...remote.worktree, hostId: 'ssh:workhost' }
    openAgentHubMirror(local)
    openAgentHubMirror(remote)
    expect(readAgentHubMirrors().windows).toHaveLength(2)
    expectInvariants()
  })
  it('rejects stale picker selections without moving or activating the newly created owner', () => {
    openAgentHubMirror(target('a'))
    openAgentHubMirror(target('b'))
    const a = owner('a'),
      b = owner('b')
    const before = readAgentHubMirrors()
    expect(addAgentHubMirrorTab(a.window.id, target('b')).status).toBe('already-owned')
    expect(readAgentHubMirrors()).toBe(before)
    expect(owner('b').window.id).toBe(b.window.id)
  })
  it('enforces the fixed 10-entry cap without consuming a window slot or parking anything', () => {
    setAgentHubMirrorWindowCap(2)
    openAgentHubMirror(target('other-window'))
    openAgentHubMirror(target('a'))
    const id = owner('a').window.id
    for (let i = 1; i < 10; i++) {
      expect(addAgentHubMirrorTab(id, target(`entry-${i}`)).status).toBe('changed')
    }
    expect(addAgentHubMirrorTab(id, target('overflow')).status).toBe('tab-cap')
    expect(readAgentHubMirrors().windows).toHaveLength(2)
    expect(readAgentHubMirrors().chips).toHaveLength(0)
    expectInvariants()
  })
  it('raises complete owners once during Pop out all, with the first request per owner selected', () => {
    openAgentHubMirror(target('a'))
    const id = owner('a').window.id
    addAgentHubMirrorTab(id, target('b'))
    openAgentHubMirror(target('c'))
    openAgentHubMirrors([target('a'), target('b'), target('d')])
    expect(owner('a').window.tabs).toHaveLength(2)
    expect(owner('a').window.activeTabId).toBe(owner('a').tab.id)
    expect(readAgentHubMirrors().windows.at(-1)?.id).toBe(id)
    expectInvariants()
  })
  it('dedupes late source aliases even when Pop out all exceeds parked history', () => {
    openAgentHubMirrors([
      ...Array.from({ length: 24 }, (_, i) => target(`batch-${i}`)),
      target('batch-0', 'batch-0:other-leaf')
    ])
    expectInvariants()
    const first = owner('batch-0')
    expect(first.tab.target.paneKey).toBeNull()
    expect(readAgentHubMirrors().chips).toHaveLength(12)
  })

  it('activates and reorders entries without changing geometry or canvas focus identity', () => {
    openAgentHubMirror(target('a'))
    const id = owner('a').window.id
    addAgentHubMirrorTab(id, target('b'))
    const place = { x: 40, y: 60, width: 640, height: 400 }
    rememberAgentHubMirrorOrigin(id, place)
    toggleAgentHubMirrorFocus(id)
    activateAgentHubMirrorTab(id, owner('a').tab.id)
    expect(readAgentHubMirrorFocus()).toBe(id)
    expect(readAgentHubMirrorOrigin(id)).toEqual(place)
    expect(reorderAgentHubMirrorTabs(id, [owner('b').tab.id, owner('a').tab.id]).status).toBe(
      'changed'
    )
    expect(owner('a').window.tabs.map((tab) => tab.target.tab.id)).toEqual(['b', 'a'])
    expect(owner('a').window.activeTabId).toBe(owner('a').tab.id)
    expect(reorderAgentHubMirrorTabs(id, [owner('a').tab.id, owner('a').tab.id]).status).toBe(
      'invalid-order'
    )
    // A disconnected entry does not block reordering the window it sits in.
    disappeared.add('b')
    expect(reorderAgentHubMirrorTabs(id, [owner('a').tab.id, owner('b').tab.id]).status).toBe(
      'changed'
    )
    expectInvariants()
  })
  it('moves atomically, preserves both places, and removes an emptied source window', () => {
    openAgentHubMirror(target('a'))
    const a = owner('a')
    addAgentHubMirrorTab(a.window.id, target('b'))
    openAgentHubMirror(target('c'))
    const c = owner('c')
    openAgentHubMirror(target('front'))
    const sourcePlace = { x: 40, y: 60, width: 500, height: 300 }
    const destinationPlace = { x: 200, y: 100, width: 600, height: 400 }
    rememberAgentHubMirrorOrigin(a.window.id, sourcePlace)
    rememberAgentHubMirrorOrigin(c.window.id, destinationPlace)
    const observed: unknown[] = []
    const stop = subscribeAgentHubMirrors(() => {
      expectInvariants()
      observed.push(captureAgentHubSession())
    })
    expect(moveAgentHubMirrorTab(a.window.id, owner('b').tab.id, c.window.id, 0).status).toBe(
      'changed'
    )
    expect(owner('b').window.tabs.map((tab) => tab.target.tab.id)).toEqual(['b', 'c'])
    expect(readAgentHubMirrors().windows.at(-1)?.id).toBe(c.window.id)
    expect(readAgentHubMirrorOrigin(a.window.id)).toEqual(sourcePlace)
    expect(readAgentHubMirrorOrigin(c.window.id)).toEqual(destinationPlace)
    expect(moveAgentHubMirrorTab(a.window.id, a.tab.id, c.window.id, 2).status).toBe('changed')
    expect(readAgentHubMirrors().windows).toHaveLength(2)
    expect(observed).toHaveLength(2)
    stop()
  })
  it('parks and restores a whole group with unchanged identity, order and active entry', () => {
    openAgentHubMirror(target('a'))
    const id = owner('a').window.id
    addAgentHubMirrorTab(id, target('b'))
    const window = owner('b').window
    minimizeAgentHubMirror(id)
    expect(readAgentHubMirrors().chips[0]?.window).toBe(window)
    restoreAgentHubMirror(id)
    expect(readAgentHubMirrors().windows[0]).toEqual(window)
    expectInvariants()
  })
  it('last-entry detach reuses identity and size, while detaching from a group claims a new window', () => {
    openAgentHubMirror(target('a'))
    const a = owner('a')
    rememberAgentHubMirrorOrigin(a.window.id, { x: 30, y: 40, width: 500, height: 300 })
    detachAgentHubMirrorTab(a.window.id, a.tab.id, { x: 80, y: 90 })
    expect(owner('a').window.id).toBe(a.window.id)
    expect(readAgentHubMirrorOrigin(a.window.id)).toMatchObject({
      width: 500,
      height: 300,
      x: Math.max(80, agentHubWorkArea().left),
      y: 90
    })
    addAgentHubMirrorTab(a.window.id, target('b'))
    const entry = owner('b').tab
    detachAgentHubMirrorTab(a.window.id, entry.id, { x: 100, y: 110 })
    expect(owner('b').window.id).not.toBe(a.window.id)
    expect(owner('b').tab.id).toBe(entry.id)
    expectInvariants()
  })
  it('returns only the requested entry and repairs the active id; closing the last closes its window', () => {
    openAgentHubMirror(target('a'))
    const a = owner('a')
    addAgentHubMirrorTab(a.window.id, target('b'))
    closeAgentHubMirrorTab(a.window.id, owner('b').tab.id)
    expect(owner('a').window.activeTabId).toBe(a.tab.id)
    closeAgentHubMirrorTab(a.window.id, a.tab.id)
    expect(readAgentHubMirrors()).toEqual({ windows: [], chips: [] })
  })
  it('revalidates source disappearance, missing owners and invalid drag positions without partial commits', () => {
    openAgentHubMirror(target('a'))
    const a = owner('a')
    openAgentHubMirror(target('b'))
    const b = owner('b')
    disappeared.add('a')
    disappeared.add('c')
    const before = readAgentHubMirrors()
    expect(addAgentHubMirrorTab(b.window.id, target('c')).status).toBe('missing-source')
    expect(activateAgentHubMirrorTab(a.window.id, a.tab.id).status).toBe('missing-source')
    expect(moveAgentHubMirrorTab(a.window.id, a.tab.id, b.window.id, 0).status).toBe(
      'missing-source'
    )
    expect(detachAgentHubMirrorTab(a.window.id, a.tab.id, { x: 0, y: 0 }).status).toBe(
      'missing-source'
    )
    expect(moveAgentHubMirrorTab('gone', b.tab.id, b.window.id, 0).status).toBe('missing-window')
    expect(detachAgentHubMirrorTab(b.window.id, b.tab.id, { x: Number.NaN, y: 0 }).status).toBe(
      'invalid-order'
    )
    expect(readAgentHubMirrors()).toBe(before)
  })
  it('merges restored survivors behind user-created windows without duplicating reservations', () => {
    openAgentHubMirror(target('a'))
    const current = owner('a')
    const b = { id: 'entry-b', target: target('b'), origin: 'manual' as const }
    reopenAgentHubMirrors([
      {
        window: { id: 'saved', tabs: [current.tab, b], activeTabId: current.tab.id },
        minimized: false,
        minimizedAt: 0,
        place: null
      }
    ])
    expect(readAgentHubMirrors().windows.map((window) => window.id)).toEqual([
      'saved',
      current.window.id
    ])
    expect(owner('b').window.activeTabId).toBe(b.id)
    expectInvariants()
  })
  it('evicts complete parked groups after 12 chips and releases every evicted source reservation', () => {
    setAgentHubMirrorWindowCap(1)
    openAgentHubMirror(target('a'))
    const id = owner('a').window.id
    addAgentHubMirrorTab(id, target('b'))
    for (let i = 0; i < 17; i++) {
      openAgentHubMirror(target(`window-${i}`))
    }
    expect(readAgentHubMirrors().chips).toHaveLength(12)
    expect(findAgentHubMirrorMembership(readAgentHubMirrors(), target('a'))).toBeNull()
    expect(findAgentHubMirrorMembership(readAgentHubMirrors(), target('b'))).toBeNull()
    expect(addAgentHubMirrorTab(owner('window-16').window.id, target('b')).status).toBe('changed')
    expectInvariants()
  })
})

describe('temporary viewing lifecycle', () => {
  it('falls back to home when a viewed pane closes, including a parked mirror', () => {
    openAgentHubMirror(target('a'))
    const a = owner('a')
    toggleAgentHubMirrorViewing(a.window.id, a.tab.id, target('worker'))
    minimizeAgentHubMirror(a.window.id)
    commitAgentHubMirrorState(
      removeAgentHubMirrorEntries(readAgentHubMirrors(), (entry) => entry.tab.id === 'worker')
    )
    expect(owner('a').presence).toBe('chip')
    expect(owner('a').tab.viewing).toBeUndefined()
    expect(findAgentHubMirrorMembership(readAgentHubMirrors(), target('worker'))).toBeNull()
  })
  it('does not save temporary viewing and drops it even from direct reopen input', () => {
    openAgentHubMirror(target('a'))
    const a = owner('a')
    toggleAgentHubMirrorViewing(a.window.id, a.tab.id, target('worker'))
    const window = owner('a').window
    const saved = captureAgentHubSession()
    expect(saved.windows[0]?.tabs[0]?.tabId).toBe('a')
    expect(saved.windows[0]?.tabs[0]).not.toHaveProperty('viewing')
    resetAgentHubMirrorsForTest()
    reopenAgentHubMirrors([{ window, minimized: false, minimizedAt: 0, place: null }])
    expect(owner('a').tab.viewing).toBeUndefined()
    expect(findAgentHubMirrorMembership(readAgentHubMirrors(), target('worker'))).toBeNull()
  })
  it('releases viewing when its home tab is moved or detached', () => {
    openAgentHubMirror(target('a'))
    openAgentHubMirror(target('b'))
    const a = owner('a'),
      b = owner('b')
    toggleAgentHubMirrorViewing(a.window.id, a.tab.id, target('worker'))
    expect(moveAgentHubMirrorTab(a.window.id, a.tab.id, b.window.id, 0).status).toBe('changed')
    expect(owner('a').tab.viewing).toBeUndefined()
    toggleAgentHubMirrorViewing(b.window.id, a.tab.id, target('worker'))
    expect(detachAgentHubMirrorTab(b.window.id, a.tab.id, { x: 50, y: 50 }).status).toBe('changed')
    expect(owner('a').tab.viewing).toBeUndefined()
    expect(findAgentHubMirrorMembership(readAgentHubMirrors(), target('worker'))).toBeNull()
  })
})

it('keeps pin partitions through reordering, moves, detach and parked restoration', () => {
  openAgentHubMirror(target('a'))
  const id = owner('a').window.id
  addAgentHubMirrorTab(id, target('b'))
  addAgentHubMirrorTab(id, target('c'))
  toggleAgentHubMirrorTabPin(id, owner('b').tab.id)
  toggleAgentHubMirrorTabPin(id, owner('c').tab.id)
  const cId = owner('c').tab.id
  reorderAgentHubMirrorTabs(id, [owner('a').tab.id, cId, owner('b').tab.id])
  expect(owner('a').window.tabs.map((tab) => tab.target.tab.id)).toEqual(['c', 'b', 'a'])
  openAgentHubMirror(target('destination'))
  const destination = owner('destination').window.id
  moveAgentHubMirrorTab(id, cId, destination, 1)
  expect(owner('c').window.tabs.map((tab) => tab.target.tab.id)).toEqual(['c', 'destination'])
  expect(owner('c').tab).toMatchObject({ id: cId, isPinned: true })
  detachAgentHubMirrorTab(destination, cId, { x: 100, y: 100 })
  const detached = owner('c').window.id
  minimizeAgentHubMirror(detached)
  restoreAgentHubMirror(detached)
  expect(owner('c').tab).toMatchObject({ id: cId, isPinned: true })
  toggleAgentHubMirrorTabPin(id, owner('b').tab.id)
  expect(owner('b').tab.isPinned).toBe(false)
  expectInvariants()
})
