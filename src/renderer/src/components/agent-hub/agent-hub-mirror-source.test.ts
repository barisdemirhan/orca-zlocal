import { acceptedAgentStatuses } from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
import { beforeEach, expect, it, vi } from 'vitest'
import { makeRepo, makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { RuntimeStatus } from '../../../../shared/remote-runtime/session-graph/runtime-session-contracts'
import {
  agentHubMirrorShellLeafId,
  findAgentHubMirrorSource,
  resolveAgentHubMirrorTarget
} from './agent-hub-mirror-source'
import { useAppStore } from '@/store'
import { agentHubChatTerminalTab } from './agent-hub-chat-tabs'
import type { Tab } from '../../../../shared/workspace-layout/tab-groups/tab-types'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  pruneClosedAgentHubMirrorSources,
  commitAgentHubMirrorState,
  minimizeAgentHubMirror,
  restoreAgentHubMirror
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
  agentStatusByPaneKey: acceptedAgentStatuses(),
  sleepingAgentSessionsByPaneKey: {},
  paneForegroundAgentByPaneKey: {},
  ptyIdsByTabId: {},
  sshConnectionStates: new Map(),
  runtimeStatusByEnvironmentId: new Map()
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
it.each(['connected', 'disconnected', 'connecting', 'unknown'] as const)(
  'handles a deleted workspace chip while its SSH host is %s',
  (status) => {
    openAgentHubMirror(target)
    const original = readAgentHubMirrors().windows[0]!
    minimizeAgentHubMirror(original.id)
    useAppStore.setState({
      worktreesByRepo: {},
      tabsByWorktree: {},
      terminalLayoutsByTabId: {},
      sshConnectionStates: new Map(
        status === 'unknown'
          ? []
          : [['workhost', { targetId: 'workhost', status, error: null, reconnectAttempt: 0 }]]
      )
    })
    restoreAgentHubMirror(original.id)
    expect(readAgentHubMirrors().windows).toHaveLength(status === 'connected' ? 0 : 1)
  }
)
it.each(['verified', 'unavailable', 'checking'] as const)(
  'handles a deleted paired-host workspace with %s contact',
  (verification) => {
    const paired = { ...worktree, hostId: 'runtime:paired' as const }
    const runtimeStatus: RuntimeStatus = {
      runtimeId: 'paired-runtime',
      rendererGraphEpoch: 1,
      graphStatus: 'ready',
      authoritativeWindowId: 1,
      liveTabCount: 0,
      liveLeafCount: 0
    }
    useAppStore.setState({
      worktreesByRepo: { [repo.id]: [paired] },
      runtimeStatusByEnvironmentId: new Map([
        [
          'paired',
          {
            status: verification === 'verified' ? runtimeStatus : null,
            checkedAt: 1,
            snapshot: {
              environmentId: 'paired',
              pairingRevision: 1,
              sequence: 1,
              checkedAt: 1,
              status: runtimeStatus,
              verification,
              transport: 'ready'
            }
          }
        ]
      ])
    })
    openAgentHubMirror({ ...target, worktree: paired })
    const original = readAgentHubMirrors().windows[0]!
    minimizeAgentHubMirror(original.id)
    useAppStore.setState({ worktreesByRepo: {}, tabsByWorktree: {}, terminalLayoutsByTabId: {} })
    restoreAgentHubMirror(original.id)
    expect(readAgentHubMirrors().windows).toHaveLength(verification === 'verified' ? 0 : 1)
  }
)
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

it('follows a pinned source moved on the same host and prunes it after closure in its new workspace', () => {
  openAgentHubMirror(target)
  const original = readAgentHubMirrors().windows[0]!
  commitAgentHubMirrorState({
    windows: [{ ...original, tabs: original.tabs.map((entry) => ({ ...entry, isPinned: true })) }],
    chips: []
  })
  minimizeAgentHubMirror(original.id)
  const moved = { ...worktree, id: 'moved-workspace' }
  useAppStore.setState({
    worktreesByRepo: { [repo.id]: [worktree, moved] },
    tabsByWorktree: { [worktree.id]: [], [moved.id]: [{ ...tab, worktreeId: moved.id }] }
  })
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors().chips[0]?.window.tabs[0]?.target.worktree.id).toBe(moved.id)
  expect(readAgentHubMirrors().chips[0]?.window.tabs[0]).toMatchObject({
    id: original.activeTabId,
    isPinned: true
  })
  expect(resolveAgentHubMirrorTarget(target)?.worktree.id).toBe(moved.id)
  useAppStore.setState({ tabsByWorktree: { [worktree.id]: [], [moved.id]: [] } })
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors()).toEqual({ windows: [], chips: [] })
})

it('prunes a chat that was the last tab of its workspace once its unified bucket empties', () => {
  const chat = {
    id: 'agent-chat-tab-v1-1',
    entityId: 'session-1',
    contentType: 'agent-session',
    worktreeId: worktree.id,
    label: 'Chat',
    agentSessionAgent: 'codex'
  } as Tab
  useAppStore.setState({ tabsByWorktree: {}, unifiedTabsByWorktree: { [worktree.id]: [chat] } })
  openAgentHubMirror({ ...target, tab: agentHubChatTerminalTab(chat) })
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  useAppStore.setState({ unifiedTabsByWorktree: { [worktree.id]: [] } })
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors().windows).toHaveLength(0)
})
it('does not treat another host inventory with equal workspace and tab ids as source closure', () => {
  openAgentHubMirror({ ...target, paneKey: makePaneKey(tab.id, leafId) })
  const original = readAgentHubMirrors().windows[0]!
  commitAgentHubMirrorState({
    windows: [{ ...original, tabs: original.tabs.map((entry) => ({ ...entry, isPinned: true })) }],
    chips: []
  })
  useAppStore.setState({
    worktreesByRepo: { [repo.id]: [{ ...worktree, hostId: 'ssh:other' }] },
    tabsByWorktree: { [worktree.id]: [] },
    terminalLayoutsByTabId: {}
  })
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors().windows[0]?.id).toBe(original.id)
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.worktree.hostId).toBe('ssh:workhost')
})

it('keeps a pinned done agent through unknown remote inventory and restore, then removes its closed leaf', () => {
  const agent = { ...target, paneKey: makePaneKey(tab.id, leafId) }
  openAgentHubMirror(agent)
  const original = readAgentHubMirrors().windows[0]!
  commitAgentHubMirrorState({
    windows: [{ ...original, tabs: original.tabs.map((entry) => ({ ...entry, isPinned: true })) }],
    chips: []
  })
  useAppStore.setState({
    agentStatusByPaneKey: acceptedAgentStatuses(
      Object.entries({
        [agent.paneKey]: {
          state: 'done',
          prompt: '',
          updatedAt: 1000,
          stateStartedAt: 1000,
          stateHistory: [],
          paneKey: agent.paneKey,
          agentType: 'claude'
        }
      })
    )
  })
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors().windows[0]?.id).toBe(original.id)
  minimizeAgentHubMirror(original.id)
  useAppStore.setState({ tabsByWorktree: {}, terminalLayoutsByTabId: {} })
  pruneClosedAgentHubMirrorSources()
  restoreAgentHubMirror(original.id)
  expect(readAgentHubMirrors().windows[0]?.tabs[0]).toMatchObject({ isPinned: true })
  const otherLeaf = '22222222-2222-4222-8222-222222222222'
  useAppStore.setState({
    ...state(),
    terminalLayoutsByTabId: {
      [tab.id]: {
        root: { type: 'leaf', leafId: otherLeaf },
        activeLeafId: otherLeaf,
        expandedLeafId: null
      }
    }
  })
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors()).toEqual({ windows: [], chips: [] })
})

it('does not rebind a moved tab to another execution host', () => {
  openAgentHubMirror(target)
  const other = { ...worktree, id: 'other-workspace', hostId: 'ssh:other' as const }
  useAppStore.setState({
    worktreesByRepo: { [repo.id]: [worktree, other] },
    tabsByWorktree: { [worktree.id]: [], [other.id]: [{ ...tab, worktreeId: other.id }] }
  })
  expect(resolveAgentHubMirrorTarget(target)).toBeNull()
  pruneClosedAgentHubMirrorSources()
  expect(readAgentHubMirrors()).toEqual({ windows: [], chips: [] })
})
