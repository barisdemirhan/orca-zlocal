import { beforeEach, expect, it, vi } from 'vitest'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import {
  agentHubMirrorShellLeafId,
  findAgentHubMirrorSource,
  resolveAgentHubMirrorTarget
} from './agent-hub-mirror-source'
import { useAppStore } from '@/store'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({})) }
})
const repo = makeRepo()
const worktree = { ...makeWorktree(), hostId: 'ssh:workhost' as const }
const tab = makeTabWithIds('tab-source', worktree.id)
const leafId = '11111111-1111-4111-8111-111111111111'
const target = { worktree, repo, tab, title: 'Source', paneKey: null, agentType: null }
const state = () => ({
  projectGroups: [],
  repos: [repo],
  worktreesByRepo: { [repo.id]: [worktree] },
  folderWorkspaces: [],
  tabsByWorktree: { [worktree.id]: [tab] },
  terminalLayoutsByTabId: {
    [tab.id]: {
      root: { type: 'leaf' as const, leafId },
      activeLeafId: leafId,
      expandedLeafId: null
    }
  },
  runtimePaneTitlesByTabId: {},
  agentStatusByPaneKey: {},
  retainedAgentsByPaneKey: {},
  sleepingAgentSessionsByPaneKey: {},
  paneForegroundAgentByPaneKey: {},
  ptyIdsByTabId: {}
})
beforeEach(() => {
  resetAgentHubMirrorsForTest()
  useAppStore.setState(state())
})
it('resolves the same execution host and refreshes source objects instead of retaining captured metadata', () => {
  const reference = {
    worktreeId: worktree.id,
    tabId: tab.id,
    hostIdentity: getWorktreeHostIdentity(worktree)
  }
  expect(findAgentHubMirrorSource(state(), reference)?.tab).toBe(tab)
  expect(
    findAgentHubMirrorSource(state(), { ...reference, hostIdentity: `local|${worktree.id}` })
  ).toBeNull()
  const liveTab = { ...tab, title: 'new live title' }
  useAppStore.setState({ tabsByWorktree: { [worktree.id]: [liveTab] } })
  expect(resolveAgentHubMirrorTarget(target)?.tab).toBe(liveTab)
})
it('keeps temporarily unverifiable remote sources even without a live local PTY', () => {
  expect(openAgentHubMirror(target)).toBe('opened')
  expect(readAgentHubMirrors().windows).toHaveLength(1)
})
it('rejects ambiguous hostless legacy references while resolving a qualified owner', () => {
  const other = { ...worktree, hostId: 'ssh:other' as const }
  const mixed = { ...state(), worktreesByRepo: { [repo.id]: [worktree, other] } }
  const reference = { worktreeId: worktree.id, tabId: tab.id, hostIdentity: null }
  expect(findAgentHubMirrorSource(mixed, reference)).toBeNull()
  expect(
    findAgentHubMirrorSource(mixed, { ...reference, hostIdentity: getWorktreeHostIdentity(other) })
      ?.worktree
  ).toBe(other)
})
it('rejects deleted and archived sources at pop-out commit time', () => {
  useAppStore.setState({ tabsByWorktree: {} })
  expect(openAgentHubMirror(target)).toBe('missing-source')
  useAppStore.setState({
    ...state(),
    worktreesByRepo: { [repo.id]: [{ ...worktree, isArchived: true }] }
  })
  expect(openAgentHubMirror(target)).toBe('missing-source')
  expect(readAgentHubMirrors().windows).toHaveLength(0)
})
it('rejects a disappeared precise leaf and a pane key for another source tab', () => {
  expect(
    resolveAgentHubMirrorTarget({ ...target, paneKey: makePaneKey(tab.id, leafId) })
  ).not.toBeNull()
  expect(
    resolveAgentHubMirrorTarget({
      ...target,
      paneKey: makePaneKey(tab.id, '22222222-2222-4222-8222-222222222222')
    })
  ).toBeNull()
  expect(
    resolveAgentHubMirrorTarget({ ...target, paneKey: makePaneKey('different-tab', leafId) })
  ).toBeNull()
})

it('falls back to an existing leaf when the active leaf of a shell mirror was removed', () => {
  const other = '22222222-2222-4222-8222-222222222222'
  const layout = (
    activeLeafId: string | null,
    root = { type: 'leaf' as const, leafId: other }
  ) => ({
    root,
    activeLeafId,
    expandedLeafId: null
  })
  expect(agentHubMirrorShellLeafId(layout(leafId))).toBe(other)
  expect(agentHubMirrorShellLeafId(layout(other))).toBe(other)
  expect(
    agentHubMirrorShellLeafId({ root: null, activeLeafId: leafId, expandedLeafId: null })
  ).toBe(leafId)
  expect(agentHubMirrorShellLeafId(undefined)).toBeNull()
})
