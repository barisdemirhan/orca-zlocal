import type * as MirrorSource from './agent-hub-mirror-source'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { AgentHubBorrowedTerminal } from './AgentHubBorrowedTerminal'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { popOutAgentHubTab } from './agent-hub-tab-popout'
import { borrowAgentHubTab, useAgentHubBorrowedTabs } from './agent-hub-borrowed-tabs'
import { addAgentHubMirrorTab, activateAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import {
  closeAgentHubMirror,
  minimizeAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type { Tab, TabGroup } from '../../../../shared/tab-types'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const groupsByWorktree: Record<string, TabGroup[]> = {}
  const unifiedTabsByWorktree: Record<string, Tab[]> = {}
  const useAppStore = create(() => ({
    settings: { experimentalAgentHub: true },
    activeView: 'terminal',
    activeWorktreeId: 'wt-1',
    activeTabId: 'source',
    activeTabType: 'terminal',
    groupsByWorktree,
    unifiedTabsByWorktree,
    activateTab: vi.fn((id: string) =>
      useAppStore.setState((s) => ({
        groupsByWorktree: {
          'wt-1': s.groupsByWorktree['wt-1'].map((g) => ({ ...g, activeTabId: id }))
        }
      }))
    ),
    focusGroup: vi.fn()
  }))
  return { useAppStore }
})

const target: AgentHubPaneTarget = {
  worktree: makeWorktree(),
  tab: makeTabWithIds('source', 'wt-1'),
  repo: null,
  paneKey: null,
  title: 'Terminal',
  agentType: null
}
function fixture(order = ['source']): void {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings!, experimentalAgentHub: true },
    groupsByWorktree: {
      'wt-1': [{ id: 'group', worktreeId: 'wt-1', activeTabId: 'source', tabOrder: order }]
    },
    unifiedTabsByWorktree: {
      'wt-1': order.map((id): Tab => ({
        id,
        entityId: id,
        worktreeId: 'wt-1',
        label: id,
        customLabel: null,
        color: null,
        createdAt: 0,
        groupId: 'group',
        contentType: 'terminal',
        isPinned: false,
        isPreview: false,
        sortOrder: 0,
        lastFocusedAt: 0
      }))
    }
  })
}
beforeEach(() => {
  fixture()
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
})

it.each([
  ['left', 'source', 'right'],
  ['left', 'source']
])('activates right then left in the same group (%s)', (...order) => {
  fixture(order)
  popOutAgentHubTab(target)
  expect(useAppStore.getState().activateTab).toHaveBeenCalledWith(
    order.includes('right') ? 'right' : 'left',
    { worktreeId: 'wt-1' }
  )
  expect(useAppStore.getState().focusGroup).toHaveBeenCalledWith('wt-1', 'group')
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  expect(useAppStore.getState().activeWorktreeId).toBe('wt-1')
})

it('borrows a singleton, shows its return control and returns without closing the tab', () => {
  let borrowed: ReturnType<typeof useAgentHubBorrowedTabs> = []
  function Host(): React.JSX.Element {
    borrowed = useAgentHubBorrowedTabs()
    return <AgentHubBorrowedTerminal worktreeId="wt-1" groupId="group" />
  }
  render(<Host />)
  act(() => popOutAgentHubTab(target))
  expect(borrowed[0]?.tabId).toBe('source')
  expect(screen.getByText('Shown in a mirror')).toBeTruthy()
  expect(isAgentHubCanvasOpen()).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Bring back' }))
  expect(borrowed).toHaveLength(0)
  expect(readAgentHubMirrors().windows).toHaveLength(0)
  expect(useAppStore.getState().unifiedTabsByWorktree['wt-1']).toHaveLength(1)
})

it('releases a borrowed placeholder when its source becomes inactive in the same window', () => {
  let borrowed: ReturnType<typeof useAgentHubBorrowedTabs> = []
  function Host(): React.JSX.Element {
    borrowed = useAgentHubBorrowedTabs()
    return <AgentHubBorrowedTerminal worktreeId="wt-1" groupId="group" />
  }
  render(<Host />)
  act(() => popOutAgentHubTab(target))
  const id = mirrorWindowIdFor('source')
  const entryId = readAgentHubMirrors().windows[0].activeTabId
  expect(borrowed).toHaveLength(1)
  act(() => {
    addAgentHubMirrorTab(id, { ...target, tab: makeTabWithIds('other', 'wt-1') })
  })
  expect(borrowed).toHaveLength(0)
  expect(readAgentHubMirrors().windows[0].id).toBe(id)
  expect(readAgentHubMirrors().windows[0].tabs.some((entry) => entry.id === entryId)).toBe(true)
})

it('returns only the borrowed active entry while preserving its grouped mirror', () => {
  render(<AgentHubBorrowedTerminal worktreeId="wt-1" groupId="group" />)
  act(() => popOutAgentHubTab(target))
  const id = mirrorWindowIdFor('source')
  const sourceEntry = readAgentHubMirrors().windows[0].activeTabId
  act(() => {
    addAgentHubMirrorTab(id, { ...target, tab: makeTabWithIds('other', 'wt-1') })
    activateAgentHubMirrorTab(id, sourceEntry)
    borrowAgentHubTab({
      worktreeId: 'wt-1',
      tabId: 'source',
      unifiedTabId: 'source',
      groupId: 'group',
      mirrorKey: id
    })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Bring back' }))
  expect(readAgentHubMirrors().windows[0].id).toBe(id)
  expect(readAgentHubMirrors().windows[0].tabs.map((entry) => entry.target.tab.id)).toEqual([
    'other'
  ])
})

it.each(['close', 'minimize', 'select another', 'disable'])(
  'clears the singleton borrow on %s',
  (action) => {
    render(<AgentHubBorrowedTerminal worktreeId="wt-1" groupId="group" />)
    act(() => popOutAgentHubTab(target))
    act(() => {
      if (action === 'close') {
        closeAgentHubMirror(mirrorWindowIdFor('source'))
      } else if (action === 'minimize') {
        minimizeAgentHubMirror(mirrorWindowIdFor('source'))
      } else if (action === 'select another') {
        useAppStore.getState().activateTab('other')
      } else {
        useAppStore.setState({
          settings: { ...useAppStore.getState().settings!, experimentalAgentHub: false }
        })
      }
    })
    expect(readAgentHubMirrors().windows).toHaveLength(
      action === 'close' || action === 'minimize' ? 0 : 1
    )
    expect(screen.queryByText('Shown in a mirror')).toBeNull()
  }
)

it('raises an existing mirror without changing the active tab', () => {
  fixture(['source', 'other'])
  popOutAgentHubTab(target)
  vi.clearAllMocks()
  popOutAgentHubTab(target)
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  expect(useAppStore.getState().activateTab).not.toHaveBeenCalled()
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))
