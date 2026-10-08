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
import { addAgentHubMirrorTab, closeAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  minimizeAgentHubMirror,
  closeAgentHubMirror,
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
it('retargets the active tab to a worker without adding a tab', () => {
  const id = open('dispatcher')
  const tabId = readAgentHubMirrors().windows.at(-1)?.activeTabId ?? ''
  selectAgentHubMirrorFamilyMember(id, tabId, target('worker'))
  const window = readAgentHubMirrors().windows.at(-1)
  expect(window?.tabs.map((tab) => tab.target.title)).toEqual(['worker'])
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
it('reports the cap reason for picker additions only; a full window can still retarget', () => {
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
  expect(window?.tabs.find((tab) => tab.id === tabId)?.target.title).toBe('twelve')
})
it('rejects a stale picker reservation with truthful feedback without raising its owner', () => {
  const owner = open('owned')
  const destination = open('destination')
  expect(addAgentHubMirrorTabWithFeedback(destination, target('owned')).status).toBe(
    'already-owned'
  )
  expect(toast.error).toHaveBeenCalledWith('This terminal is already popped out.')
  expect(readAgentHubMirrors().windows.at(-1)?.id).toBe(destination)
  expect(readAgentHubMirrors().windows.find((window) => window.id === owner)?.tabs).toHaveLength(1)
})
it('tab and window closes release memberships without calling terminal close or kill', () => {
  const id = open('a')
  addAgentHubMirrorTab(id, target('b'))
  addAgentHubMirrorTab(id, target('c'))
  const b = readAgentHubMirrors().windows[0]?.tabs[1]
  if (!b) {
    throw new Error('No b')
  }
  closeAgentHubMirrorTab(id, b.id)
  closeAgentHubMirror(id)
  expect(readAgentHubMirrors().windows).toHaveLength(0)
  expect(closeTab).not.toHaveBeenCalled()
  expect(kill).not.toHaveBeenCalled()
})
