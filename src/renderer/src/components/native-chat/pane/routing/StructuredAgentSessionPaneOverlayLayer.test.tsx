// @vitest-environment happy-dom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Tab, TabGroup } from '../../../../../../shared/tab-types'

type MockAppState = {
  unifiedTabsByWorktree: Record<string, readonly Tab[]>
  groupsByWorktree: Record<string, readonly TabGroup[]>
  activeGroupIdByWorktree: Record<string, string>
  runtimeEnvironmentId: string | null
  focusGroup: (worktreeId: string, groupId: string) => void
}

const mocks = vi.hoisted(() => ({
  store: null as null | { setState: (state: Partial<MockAppState>) => void },
  focusGroup: vi.fn(),
  mountsByTabId: new Map<string, number>(),
  unmountsByTabId: new Map<string, number>(),
  groupIdByTabId: new Map<string, string | undefined>(),
  targetByTabId: new Map<string, unknown>()
}))

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const useAppStore = create<MockAppState>(() => ({
    unifiedTabsByWorktree: {},
    groupsByWorktree: {},
    activeGroupIdByWorktree: {},
    runtimeEnvironmentId: null,
    focusGroup: mocks.focusGroup
  }))
  mocks.store = useAppStore
  return { useAppStore }
})

vi.mock('@/lib/workspace/ownership/worktree-runtime-owner', () => ({
  getExecutionHostIdForWorktree: (state: MockAppState) =>
    state.runtimeEnvironmentId ? `runtime:${state.runtimeEnvironmentId}` : 'local'
}))

vi.mock('../../NativeChatView', async () => {
  const { useContext, useEffect } = await import('react')
  const { NativeChatPresentationContext } = await import('../../native-chat-presentation-context')
  return {
    default: function MockNativeChatView({
      tabId,
      groupId,
      isVisible,
      isFocusedGroup,
      target
    }: {
      tabId: string
      groupId?: string
      isVisible: boolean
      isFocusedGroup: boolean
      target: unknown
    }) {
      const presentation = useContext(NativeChatPresentationContext)
      mocks.groupIdByTabId.set(tabId, groupId)
      mocks.targetByTabId.set(tabId, target)
      useEffect(() => {
        mocks.mountsByTabId.set(tabId, (mocks.mountsByTabId.get(tabId) ?? 0) + 1)
        return () => {
          mocks.unmountsByTabId.set(tabId, (mocks.unmountsByTabId.get(tabId) ?? 0) + 1)
        }
      }, [tabId])
      return (
        <span
          data-chat-tab-id={tabId}
          data-chat-visible={String(isVisible)}
          data-chat-focused-group={String(isFocusedGroup)}
          data-chat-presentation={presentation}
          data-native-chat-working="true"
        />
      )
    }
  }
})

import StructuredAgentSessionPaneOverlayLayer from './StructuredAgentSessionPaneOverlayLayer'
import {
  closeAgentHubOrbPanel,
  setAgentHubOrbDestination,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from '../../../agent-hub/agent-hub-orb-panel-store'

const WORKTREE_ID = 'wt-1'
const GROUP_ID = 'group-1'

const FIRST_TAB_ID = 'structured-agent-session-session-1'
const SECOND_TAB_ID = 'structured-agent-session-session-2'

describe('StructuredAgentSessionPaneOverlayLayer', () => {
  beforeEach(() => {
    closeAgentHubOrbPanel()
    mocks.focusGroup.mockClear()
    mocks.mountsByTabId.clear()
    mocks.unmountsByTabId.clear()
    mocks.groupIdByTabId.clear()
    mocks.targetByTabId.clear()
    mocks.store?.setState(createState(FIRST_TAB_ID))
  })

  afterEach(() => {
    closeAgentHubOrbPanel()
    cleanup()
  })

  it('moves one retained chat into Orb and back without remounting or changing the session host', () => {
    const { container, rerender } = render(
      <StructuredAgentSessionPaneOverlayLayer worktreeId={WORKTREE_ID} isWorktreeActive />
    )
    const chat = chatSurface(container, FIRST_TAB_ID)
    expect(chat.dataset.chatPresentation).toBe('chat')
    const destination = document.createElement('div')
    document.body.append(destination)
    act(() => {
      showAgentHubOrbPanel({ sessionId: 'session-1', tabId: FIRST_TAB_ID, resumed: false })
      setAgentHubOrbDestination(destination)
    })
    rerender(
      <StructuredAgentSessionPaneOverlayLayer worktreeId={WORKTREE_ID} isWorktreeActive={false} />
    )
    expect(chatSurface(destination, FIRST_TAB_ID)).toBe(chat)
    expect(chat.dataset.chatVisible).toBe('true')
    expect(chat.dataset.chatFocusedGroup).toBe('true')
    expect(chat.dataset.chatPresentation).toBe('orb')
    expect(chatSurface(container, SECOND_TAB_ID).dataset.chatPresentation).toBe('chat')
    expect(container.querySelector(`[data-chat-tab-id="${FIRST_TAB_ID}"]`)).toBeNull()
    act(() => useAgentHubOrbPanel.setState({ chatVisible: false }))
    expect(chat.dataset.chatVisible).toBe('false')
    act(() => closeAgentHubOrbPanel())
    expect(chatSurface(container, FIRST_TAB_ID)).toBe(chat)
    expect(chat.dataset.chatPresentation).toBe('chat')
    expect(mocks.mountsByTabId.get(FIRST_TAB_ID)).toBe(1)
    expect(mocks.unmountsByTabId.get(FIRST_TAB_ID) ?? 0).toBe(0)
    destination.remove()
  })

  it('keeps materialized chat surfaces mounted while activation only swaps visibility', () => {
    const view = render(
      <StructuredAgentSessionPaneOverlayLayer worktreeId={WORKTREE_ID} isWorktreeActive />
    )
    const firstBefore = chatSurface(view.container, FIRST_TAB_ID)
    const secondBefore = chatSurface(view.container, SECOND_TAB_ID)

    expect(firstBefore.dataset.chatVisible).toBe('true')
    expect(secondBefore.dataset.chatVisible).toBe('false')
    expect(mocks.mountsByTabId).toEqual(
      new Map([
        [FIRST_TAB_ID, 1],
        [SECOND_TAB_ID, 1]
      ])
    )

    act(() => {
      mocks.store?.setState({
        groupsByWorktree: {
          [WORKTREE_ID]: [createGroup(SECOND_TAB_ID)]
        }
      })
    })

    const firstAfter = chatSurface(view.container, FIRST_TAB_ID)
    const secondAfter = chatSurface(view.container, SECOND_TAB_ID)
    expect(firstAfter).toBe(firstBefore)
    expect(secondAfter).toBe(secondBefore)
    expect(firstAfter.dataset.chatVisible).toBe('false')
    expect(secondAfter.dataset.chatVisible).toBe('true')
    expect(mocks.mountsByTabId.get(FIRST_TAB_ID)).toBe(1)
    expect(mocks.mountsByTabId.get(SECOND_TAB_ID)).toBe(1)
    expect(mocks.unmountsByTabId.size).toBe(0)
    expect(mocks.groupIdByTabId).toEqual(
      new Map([
        [FIRST_TAB_ID, GROUP_ID],
        [SECOND_TAB_ID, GROUP_ID]
      ])
    )
  })
})

function createState(activeTabId: string): MockAppState {
  return {
    unifiedTabsByWorktree: {
      [WORKTREE_ID]: [
        structuredTab(FIRST_TAB_ID, 'session-1', 0),
        structuredTab(SECOND_TAB_ID, 'session-2', 1)
      ]
    },
    groupsByWorktree: { [WORKTREE_ID]: [createGroup(activeTabId)] },
    activeGroupIdByWorktree: { [WORKTREE_ID]: GROUP_ID },
    runtimeEnvironmentId: null,
    focusGroup: mocks.focusGroup
  }
}

function createGroup(activeTabId: string): TabGroup {
  return {
    id: GROUP_ID,
    worktreeId: WORKTREE_ID,
    activeTabId,
    tabOrder: [FIRST_TAB_ID, SECOND_TAB_ID]
  }
}

function structuredTab(id: string, sessionId: string, sortOrder: number): Tab {
  return {
    id,
    entityId: sessionId,
    groupId: GROUP_ID,
    worktreeId: WORKTREE_ID,
    contentType: 'agent-session',
    agentSessionAgent: 'codex',
    label: 'Codex Chat',
    customLabel: null,
    color: null,
    sortOrder,
    createdAt: sortOrder + 1
  }
}

function chatSurface(container: HTMLElement, tabId: string): HTMLElement {
  const surface = container.querySelector<HTMLElement>(`[data-chat-tab-id="${tabId}"]`)
  if (!surface) {
    throw new Error(`missing structured chat surface ${tabId}`)
  }
  return surface
}
