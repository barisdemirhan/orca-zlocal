/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as MirrorSource from './agent-hub-mirror-source'
import { toast } from 'sonner'
import {
  selectAgentHubMirrorFamilyMember,
  addAgentHubMirrorTabWithFeedback,
  agentHubMirrorTabCapReason
} from './agent-hub-mirror-tab-actions'
import {
  findAgentHubMirrorMembership,
  shownAgentHubMirrorTarget
} from './agent-hub-mirror-membership'
import { releaseAgentHubMirrorShownTarget } from './agent-hub-mirror-viewing'
import {
  addAgentHubMirrorTab,
  closeAgentHubMirrorTab,
  returnAgentHubMirrorTabToWorkspace,
  toggleAgentHubMirrorTabPin
} from './agent-hub-mirror-tab-operations'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  minimizeAgentHubMirror,
  closeAgentHubMirror,
  subscribeAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
const { closeTab, kill } = vi.hoisted(() => ({ closeTab: vi.fn(), kill: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ closeTab, kill }) } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  resetAgentHubMirrorsForTest()
  vi.clearAllMocks()
})
function target(id: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(id, worktree.id),
    paneKey: null,
    title: id,
    agentType: null
  }
}
function open(id: string): string {
  openAgentHubMirror(target(id))
  const windowId = readAgentHubMirrors().windows.at(-1)?.id
  if (!windowId) {
    throw new Error('No window')
  }
  return windowId
}
it('views and toggles a worker without changing the home tab identity', () => {
  const id = open('dispatcher')
  const tabId = readAgentHubMirrors().windows.at(-1)?.activeTabId ?? ''
  selectAgentHubMirrorFamilyMember(id, tabId, target('worker'))
  const window = readAgentHubMirrors().windows.at(-1)
  expect(window?.tabs.map((tab) => tab.target.title)).toEqual(['dispatcher'])
  expect(window?.tabs[0]?.viewing?.title).toBe('worker')
  expect(findAgentHubMirrorMembership(readAgentHubMirrors(), target('worker'))?.kind).toBe(
    'viewing'
  )
  selectAgentHubMirrorFamilyMember(id, tabId, target('worker'))
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeUndefined()
  expect(window?.activeTabId).toBe(tabId)
})
it('raises the existing owner, including a parked owner, instead of creating a duplicate', () => {
  const source = open('dispatcher'),
    owner = open('worker')
  addAgentHubMirrorTab(owner, target('other'))
  minimizeAgentHubMirror(owner)
  selectAgentHubMirrorFamilyMember(
    source,
    readAgentHubMirrors().windows.find((item) => item.id === source)?.activeTabId ?? '',
    target('worker')
  )
  const window = readAgentHubMirrors().windows.at(-1)
  expect(window?.id).toBe(owner)
  expect(window?.tabs.find((tab) => tab.id === window.activeTabId)?.target.title).toBe('worker')
  expect(readAgentHubMirrors().chips).toHaveLength(0)
  expect(readAgentHubMirrors().windows).toHaveLength(2)
})
it('reports the cap reason for picker additions only; a full window can still view a worker', () => {
  const id = open('a')
  for (let i = 1; i < 10; i++) {
    addAgentHubMirrorTab(id, target(String(i)))
  }
  expect(addAgentHubMirrorTabWithFeedback(id, target('eleven')).status).toBe('tab-cap')
  expect(toast.error).toHaveBeenCalledWith(agentHubMirrorTabCapReason())
  vi.clearAllMocks()
  const tabId = readAgentHubMirrors().windows[0]?.activeTabId ?? ''
  selectAgentHubMirrorFamilyMember(id, tabId, target('twelve'))
  expect(toast.error).not.toHaveBeenCalled()
  const window = readAgentHubMirrors().windows[0]
  expect(window?.tabs).toHaveLength(10)
  expect(window?.tabs.find((tab) => tab.id === tabId)?.viewing?.title).toBe('twelve')
  expect(addAgentHubMirrorTabWithFeedback(id, target('twelve')).status).toBe('tab-cap')
  expect(
    readAgentHubMirrors().windows[0]?.tabs.find((tab) => tab.id === tabId)?.viewing?.title
  ).toBe('twelve')
})
it('keeps a pinned membership on Jump and permits an explicit return without closing the source', () => {
  const id = open('a')
  addAgentHubMirrorTab(id, target('b'))
  addAgentHubMirrorTab(id, target('c'))
  const b = readAgentHubMirrors().windows[0]?.tabs[1]
  if (!b) {
    throw new Error('No b')
  }
  toggleAgentHubMirrorTabPin(id, b.id)
  expect(closeAgentHubMirrorTab(id, b.id).status).toBe('noop')
  const before = readAgentHubMirrors()
  expect(releaseAgentHubMirrorShownTarget(id, b.id)?.tab.id).toBe('b')
  expect(readAgentHubMirrors()).toBe(before)
  expect(returnAgentHubMirrorTabToWorkspace(id, b.id).status).toBe('changed')
  expect(readAgentHubMirrors().windows[0]?.tabs.map((tab) => tab.target.tab.id)).toEqual(['a', 'c'])
  closeAgentHubMirror(id)
  expect(readAgentHubMirrors().windows).toHaveLength(0)
  expect(closeTab).not.toHaveBeenCalled()
  expect(kill).not.toHaveBeenCalled()
})

it.each([false, true])('keeps a pinned tab viewing its worker on Jump, parked: %s', (parked) => {
  const id = open('dispatcher')
  const tabId = readAgentHubMirrors().windows[0]?.activeTabId ?? ''
  selectAgentHubMirrorFamilyMember(id, tabId, target('worker'))
  toggleAgentHubMirrorTabPin(id, tabId)
  if (parked) {
    minimizeAgentHubMirror(id)
  }
  const before = readAgentHubMirrors()
  expect(releaseAgentHubMirrorShownTarget(id, tabId)?.tab.id).toBe('worker')
  expect(readAgentHubMirrors()).toBe(before)
  expect(findAgentHubMirrorMembership(before, target('worker'))?.kind).toBe('viewing')
  expect(closeTab).not.toHaveBeenCalled()
  expect(kill).not.toHaveBeenCalled()
})

it('turns the viewed member into an active real tab with one PTY reservation', () => {
  const id = open('dispatcher')
  const tabId = readAgentHubMirrors().windows[0]?.activeTabId ?? ''
  selectAgentHubMirrorFamilyMember(id, tabId, target('worker'))
  expect(addAgentHubMirrorTabWithFeedback(id, target('worker')).status).toBe('changed')
  const window = readAgentHubMirrors().windows[0]
  expect(window?.tabs.map((tab) => tab.target.title)).toEqual(['dispatcher', 'worker'])
  expect(window?.tabs[0]?.viewing).toBeUndefined()
  expect(window?.activeTabId).toBe(window?.tabs[1]?.id)
  expect(findAgentHubMirrorMembership(readAgentHubMirrors(), target('worker'))?.kind).toBe('tab')
})
it('pops a viewed member out atomically while retaining its home window', () => {
  const id = open('dispatcher')
  const tabId = readAgentHubMirrors().windows[0]?.activeTabId ?? ''
  selectAgentHubMirrorFamilyMember(id, tabId, target('worker'))
  const stop = subscribeAgentHubMirrors(() => {
    const shown = readAgentHubMirrors().windows.map((window) => {
      const active = window.tabs.find((tab) => tab.id === window.activeTabId)
      if (!active) {
        throw new Error('Missing active tab')
      }
      return shownAgentHubMirrorTarget(active).tab.id
    })
    expect(new Set(shown).size).toBe(shown.length)
  })
  openAgentHubMirror(target('worker'))
  stop()
  const windows = readAgentHubMirrors().windows
  expect(windows).toHaveLength(2)
  expect(windows[0]?.id).toBe(id)
  expect(windows[0]?.tabs[0]?.viewing).toBeUndefined()
  expect(windows[0]?.tabs[0]?.target.title).toBe('dispatcher')
  const shown = windows.flatMap((window) => window.tabs.map(shownAgentHubMirrorTarget))
  expect(shown.filter((entry) => entry.tab.id === 'worker')).toHaveLength(1)
})
