import type * as MirrorSource from './agent-hub-mirror-source'
/** @vitest-environment happy-dom */
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import {
  makeTabWithIds,
  makeRepo,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import SortableTab from '../tab-bar/SortableTab'
import BrowserTab from '../tab-bar/BrowserTab'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubFloatingPopoutProvider } from './AgentHubTabPopout'
import { readAgentHubMirrors, resetAgentHubMirrorsForTest } from './agent-hub-mirror-store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      settings: { experimentalAgentHub: true, agentHubTabAutoPopout: true },
      keybindings: { 'agentHub.popOut': ['Mod+F7'] },
      projectGroups: [],
      repos: [],
      worktreesByRepo: {},
      folderWorkspaces: [],
      tabsByWorktree: {},
      groupsByWorktree: {},
      unifiedTabsByWorktree: {},
      activeWorktreeId: null,
      activeView: 'terminal',
      activeTabId: null,
      activeTabType: 'terminal',
      terminalLayoutsByTabId: {},
      runtimePaneTitlesByTabId: {},
      agentStatusByPaneKey: {},
      retainedAgentsByPaneKey: {},
      sleepingAgentSessionsByPaneKey: {},
      paneForegroundAgentByPaneKey: {},
      ptyIdsByTabId: {},
      unreadTerminalTabs: {},
      unreadAgentCompletionPanes: {},
      browserPagesByWorkspace: {},
      browserAudiblePageIds: {},
      browserAudioMutedTabIds: {},
      setBrowserTabAudioMuted: () => {}
    }))
  }
})
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn() })
}))
vi.mock('@/lib/agent-session/tab-identity/use-tab-agent', () => ({
  useTabAgent: (tab: TerminalTab) => tab.launchAgent ?? null
}))
vi.mock('../tab-bar/SortableTabContextMenu', () => ({
  SortableTabContextMenu: ({ open }: { open: boolean }) =>
    open ? <div role="menu">Terminal menu</div> : null
}))

function setEnabled(enabled: boolean): void {
  act(() => {
    useAppStore.setState((state) => ({
      settings: state.settings ? { ...state.settings, experimentalAgentHub: enabled } : null
    }))
  })
}

function fixture(agent = false, worktreeId = FLOATING_TERMINAL_WORKTREE_ID) {
  const tab: TerminalTab = {
    ...makeTabWithIds('floating-terminal', worktreeId),
    title: 'Terminal',
    ...(agent ? { launchAgent: 'claude' as const } : {})
  }
  const repo = makeRepo()
  useAppStore.setState({
    tabsByWorktree: { [worktreeId]: [tab] },
    repos: [repo],
    worktreesByRepo: { [repo.id]: [{ ...makeWorktree(), id: worktreeId }] }
  })
  const onOpenChange = vi.fn()
  const onActivate = vi.fn()
  const onClose = vi.fn()
  const node = (
    <SortableTab
      tab={tab}
      agent={agent ? 'claude' : null}
      unifiedTabId={tab.id}
      groupId="floating-group"
      tabCount={1}
      hasTabsToRight={false}
      hasTabsToLeft={false}
      isActive
      isPinned={false}
      isExpanded={false}
      onActivate={onActivate}
      onClose={onClose}
      onCloseOthers={vi.fn()}
      onCloseToRight={vi.fn()}
      onCloseToLeft={vi.fn()}
      onSetCustomTitle={vi.fn()}
      onSetTabColor={vi.fn()}
      onTogglePin={vi.fn()}
      onToggleExpand={vi.fn()}
      dragData={{
        kind: 'tab',
        worktreeId,
        groupId: 'floating-group',
        unifiedTabId: tab.id,
        visibleTabId: tab.id,
        tabType: 'terminal',
        label: tab.title
      }}
    />
  )
  render(
    <TooltipProvider>
      <AgentHubFloatingPopoutProvider onOpenChange={onOpenChange}>
        {node}
      </AgentHubFloatingPopoutProvider>
    </TooltipProvider>
  )
  return { tab, onOpenChange, onActivate, onClose }
}

beforeEach(() => {
  resetAgentHubMirrorsForTest()
  setEnabled(true)
  useAppStore.setState((s) => ({
    settings: s.settings ? { ...s.settings, agentHubTabAutoPopout: true } : null
  }))
})
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
})

describe('floating terminal pop-out', () => {
  it.each([false, true])(
    'opens the existing mirror path and hides without closing (agent=%s)',
    (agent) => {
      const { tab, onOpenChange, onActivate, onClose } = fixture(agent)
      const button = screen.getByRole('button', { name: 'Pop out' })
      fireEvent.pointerDown(button)
      fireEvent.mouseDown(button)
      fireEvent.doubleClick(button)
      fireEvent.click(button)
      expect(readAgentHubMirrors().windows).toMatchObject([
        {
          tabs: [
            {
              target: {
                tab: { id: tab.id },
                worktree: { id: FLOATING_TERMINAL_WORKTREE_ID },
                agentType: agent ? 'claude' : null
              }
            }
          ]
        }
      ])
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
      expect(onActivate).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
      expect(useAppStore.getState().tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toEqual([tab])
      expect(screen.queryByRole('textbox')).toBeNull()
    }
  )

  it('has a bound shortcut on focus and no context menu; the tab menu still works', async () => {
    fixture()
    const button = screen.getByRole('button', { name: 'Pop out' })
    fireEvent.focus(button)
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain('F7'))
    fireEvent.contextMenu(button)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.contextMenu(screen.getByTestId('sortable-tab'))
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('reacts to the Hub gate and never hides a panel for a removed terminal', () => {
    const { onOpenChange } = fixture()
    setEnabled(false)
    expect(screen.queryByRole('button', { name: 'Pop out' })).toBeNull()
    setEnabled(true)
    act(() => useAppStore.setState({ tabsByWorktree: {} }))
    fireEvent.click(screen.getByRole('button', { name: 'Pop out' }))
    expect(readAgentHubMirrors().windows).toHaveLength(0)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('opens normal workspace tabs without hiding the floating panel', () => {
    const { onOpenChange } = fixture(false, 'normal-workspace')
    fireEvent.click(screen.getByRole('button', { name: 'Pop out' }))
    expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.worktree.id).toBe('normal-workspace')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('honors the stored tab button setting', () => {
    fixture()
    act(() =>
      useAppStore.setState((s) => ({
        settings: s.settings ? { ...s.settings, agentHubTabAutoPopout: false } : null
      }))
    )
    expect(screen.queryByRole('button', { name: 'Pop out' })).toBeNull()
  })

  it('does not add a button to a browser tab in the floating strip', () => {
    render(
      <TooltipProvider>
        <AgentHubFloatingPopoutProvider onOpenChange={vi.fn()}>
          <BrowserTab
            tab={{
              id: 'browser',
              worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
              url: 'about:blank',
              title: 'Mailpit - localhost',
              faviconUrl: null,
              loading: false,
              canGoBack: false,
              canGoForward: false,
              loadError: null,
              createdAt: 1
            }}
            isActive
            isPinned
            tabCount={1}
            hasTabsToLeft={false}
            hasTabsToRight={false}
            onActivate={vi.fn()}
            onClose={vi.fn()}
            onCloseOthers={vi.fn()}
            onCloseToRight={vi.fn()}
            onCloseToLeft={vi.fn()}
            onTogglePin={vi.fn()}
            dragData={{
              kind: 'tab',
              worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
              groupId: 'floating-group',
              unifiedTabId: 'browser',
              visibleTabId: 'browser',
              tabType: 'browser',
              label: 'Mailpit - localhost'
            }}
          />
        </AgentHubFloatingPopoutProvider>
      </TooltipProvider>
    )
    expect(screen.getByText('Mailpit - localhost')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pop out' })).toBeNull()
  })
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))
