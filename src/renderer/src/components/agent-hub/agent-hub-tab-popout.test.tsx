/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { AgentHubBorrowedTerminal } from './AgentHubBorrowedTerminal'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { popOutAgentHubTab } from './agent-hub-tab-popout'
import { useAgentHubBorrowedTabs } from './agent-hub-borrowed-tabs'
import {
  closeAgentHubMirror,
  minimizeAgentHubMirror,
  readAgentHubMirrors,
  retargetAgentHubMirror,
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

it.each(['close', 'minimize', 'select another', 'disable'])(
  'clears the singleton borrow on %s',
  (action) => {
    render(<AgentHubBorrowedTerminal worktreeId="wt-1" groupId="group" />)
    act(() => popOutAgentHubTab(target))
    act(() => {
      if (action === 'close') {
        closeAgentHubMirror('source')
      } else if (action === 'minimize') {
        minimizeAgentHubMirror('source')
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

it('returns a singleton after its mirror targets a different pane in the same tab', () => {
  render(<AgentHubBorrowedTerminal worktreeId="wt-1" groupId="group" />)
  act(() => popOutAgentHubTab(target))
  act(() => retargetAgentHubMirror('source', { ...target, paneKey: 'other-pane' }))
  fireEvent.click(screen.getByRole('button', { name: 'Bring back' }))
  expect(readAgentHubMirrors().windows).toHaveLength(0)
  expect(screen.queryByText('Shown in a mirror')).toBeNull()
})

it('leaving the source tab never opens a mirror', () => {
  fixture(['source', 'other'])
  useAppStore.getState().activateTab('other')
  expect(readAgentHubMirrors().windows).toHaveLength(0)
})

it('raises an existing mirror without changing the active tab', () => {
  fixture(['source', 'other'])
  popOutAgentHubTab(target)
  vi.clearAllMocks()
  popOutAgentHubTab(target)
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  expect(useAppStore.getState().activateTab).not.toHaveBeenCalled()
})
