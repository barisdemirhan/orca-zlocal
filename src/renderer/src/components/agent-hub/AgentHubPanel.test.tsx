import { acceptedAgentStatuses } from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
import type * as MirrorSource from './agent-hub-mirror-source'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
// @vitest-environment happy-dom

import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { buildActivityEvents } from '../activity/events/activity-event-builder'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree,
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3
} from './agent-hub-activity-test-fixtures'
import { AgentHubPanel } from './AgentHubPanel'
import { AgentHubRow } from './AgentHubRow'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { buildAgentHubLists } from './agent-hub-lists'
import {
  minimizeAgentHubMirror,
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import { buildAgentHubTerminalTree } from './agent-hub-terminal-tree'
import type { AgentHubTreeOrder } from './agent-hub-terminal-tree-sort'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  resetAgentHubMirrorsForTest()
})

// Two unread finished agents (newest first: tab-3, tab-2) and one working agent (tab-1).
function fixture() {
  const repo = makeRepo()
  const worktree = makeWorktree()
  const tabs = ['tab-1', 'tab-2', 'tab-3'].map((id) => makeTabWithIds(id, worktree.id))
  const entry = (
    paneKey: string,
    state: AgentStatusEntry['state'],
    at: number
  ): AgentStatusEntry => ({
    state,
    prompt: `Task ${paneKey.slice(0, 5)}`,
    updatedAt: at,
    stateStartedAt: at,
    paneKey,
    terminalTitle: 'Claude',
    stateHistory: [],
    agentType: 'claude'
  })
  const threads = makeThreads(
    buildActivityEvents({
      chatNames: new Map(),
      agentStatusByPaneKey: acceptedAgentStatuses(
        Object.entries({
          [PANE_KEY]: entry(PANE_KEY, 'working', 3_000),
          [PANE_KEY_2]: entry(PANE_KEY_2, 'done', 1_000),
          [PANE_KEY_3]: entry(PANE_KEY_3, 'done', 2_000)
        })
      ),
      tabsByWorktree: { [worktree.id]: tabs },
      worktreeMap: new Map([[worktree.id, worktree]]),
      repoMap: new Map([[repo.id, repo]]),
      acknowledgedAgentsByPaneKey: {},
      now: 3_000
    })
  )
  const tree = buildAgentHubTerminalTree({
    projectGroups: [],
    repos: [repo],
    worktreesByRepo: { [repo.id]: [worktree] },
    folderWorkspaces: [],
    tabsByWorktree: { [worktree.id]: tabs },
    threads,
    floating: null,
    includeShells: true,
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Unknown'
  })
  return { lists: buildAgentHubLists(threads), tree }
}

const PROJECT_ORDER: AgentHubTreeOrder = { sortBy: 'repo', workspaceRank: new Map(), now: 0 }

function renderPanel(treeOrder: AgentHubTreeOrder = PROJECT_ORDER) {
  const { lists, tree } = fixture()
  const handlers = {
    onSortChange: vi.fn(),
    onJump: vi.fn(),
    onOpen: vi.fn(),
    onPopout: vi.fn(),
    onPopoutAll: vi.fn(),
    onMarkRead: vi.fn(),
    onClose: vi.fn()
  }
  const rootRef = createRef<HTMLDivElement>()
  act(() => {
    root.render(
      <TooltipProvider>
        <AgentHubPanel
          lists={lists}
          lineage={EMPTY_AGENT_HUB_LINEAGE}
          tree={tree}
          treeOrder={treeOrder}
          terminalCount={3}
          locationOf={() => ({ group: null, project: 'Repo', workspace: 'feature' })}
          rootRef={rootRef}
          {...handlers}
        />
      </TooltipProvider>
    )
  })
  return { handlers, panel: rootRef }
}

function press(target: Element | null, key: string, init: KeyboardEventInit = {}): void {
  if (!target) {
    throw new Error(`no target for ${key}`)
  }
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  })
}

describe('AgentHubPanel keyboard', () => {
  it('opens the selected finished agent with Enter and pops it out with Alt+Enter', () => {
    const { handlers, panel } = renderPanel()

    press(panel.current, 'ArrowDown')
    press(panel.current, 'Enter')
    expect(handlers.onJump).toHaveBeenCalledTimes(1)
    expect(handlers.onJump.mock.calls[0]?.[0].thread.paneKey).toBe(PANE_KEY_3)

    press(panel.current, 'ArrowDown')
    press(panel.current, 'Enter', { altKey: true })
    expect(handlers.onPopout.mock.calls[0]?.[0].thread.paneKey).toBe(PANE_KEY_2)
  })

  it('switches to Running with Tab and opens the working agent', () => {
    const { handlers, panel } = renderPanel()

    press(panel.current, 'Tab')
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'Running'
    )
    press(panel.current, 'ArrowDown')
    press(panel.current, 'Enter')
    expect(handlers.onJump.mock.calls[0]?.[0].thread.paneKey).toBe(PANE_KEY)
  })

  it('pops out every running agent at once from the Running tab', () => {
    const { handlers, panel } = renderPanel()

    press(panel.current, 'Tab')
    const button = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Pop out all'
    )
    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const [requests] = handlers.onPopoutAll.mock.calls[0] ?? []
    expect(
      requests.map((request: { target: { paneKey: string } }) => request.target.paneKey)
    ).toEqual([PANE_KEY])
  })

  it('marks every finished agent read at once', () => {
    const { handlers } = renderPanel()
    const button = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Mark all read'
    )
    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(handlers.onMarkRead).toHaveBeenCalledWith([PANE_KEY_3, PANE_KEY_2])
  })

  it('lists every terminal under All terminals, agents and shells alike', () => {
    const { panel } = renderPanel()

    press(panel.current, 'Tab', { shiftKey: true })
    const rows = [...container.querySelectorAll('[data-agent-hub-row]')]
    expect(rows).toHaveLength(3)
  })
})

describe('AgentHubPanel terminal sort', () => {
  const rowTitles = (): (string | null)[] =>
    [...container.querySelectorAll('[data-agent-hub-row]')].map((row) => row.textContent)
  const sortButton = (): HTMLButtonElement | null =>
    container.querySelector('button[data-agent-hub-list-menu="sort"]')

  it('lists and selects rows in the chosen order', () => {
    // Agent Activity: the unread results (newest first), then the working agent.
    const { handlers, panel } = renderPanel({
      sortBy: 'smart',
      workspaceRank: new Map(),
      now: 5_000
    })
    press(panel.current, 'Tab', { shiftKey: true })
    const smartOrder = rowTitles()

    press(panel.current, 'ArrowDown')
    press(panel.current, 'Enter')
    expect(handlers.onJump.mock.calls[0]?.[0].thread.paneKey).toBe(PANE_KEY_3)
    press(panel.current, 'ArrowDown')
    press(panel.current, 'ArrowDown')
    press(panel.current, 'Enter')
    expect(handlers.onJump.mock.calls[1]?.[0].thread.paneKey).toBe(PANE_KEY)

    act(() => root.unmount())
    root = createRoot(container)
    const project = renderPanel()
    press(project.panel.current, 'Tab', { shiftKey: true })
    expect(rowTitles()).not.toEqual(smartOrder)
    press(project.panel.current, 'ArrowDown')
    press(project.panel.current, 'Enter')
    expect(project.handlers.onJump.mock.calls[0]?.[0].thread.paneKey).toBe(PANE_KEY)
  })

  it('reports a pick from the sort menu', () => {
    const { handlers, panel } = renderPanel()
    press(panel.current, 'Tab', { shiftKey: true })

    act(() => {
      sortButton()?.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false })
      )
    })
    const options = [...document.querySelectorAll('[role="menuitemradio"]')]
    expect(options.map((option) => option.textContent)).toEqual([
      'Name',
      'Agent Activity',
      'Recent',
      'Project',
      'Manual'
    ])
    expect(
      options.find((option) => option.getAttribute('aria-checked') === 'true')?.textContent
    ).toBe('Project')
    act(() => {
      options[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handlers.onSortChange).toHaveBeenCalledWith('recent')
  })
})

describe('AgentHubPanel header settings button', () => {
  it('opens Agent Hub settings and closes the hub', () => {
    const { handlers } = renderPanel()
    const button = container.querySelector('button[aria-label="Open Agent Hub settings"]')
    if (!button) {
      throw new Error('no settings button in the header')
    }
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const state = useAppStore.getState()
    expect(state.settingsNavigationTarget).toEqual({ pane: 'agentHub', repoId: null })
    expect(state.activeView).toBe('settings')
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('AgentHubRow close button', () => {
  it.each([
    [false, 1],
    [true, 0]
  ])('selectionMode=%s shows %s close buttons', (selectionMode, count) => {
    act(() =>
      root.render(
        <TooltipProvider>
          <AgentHubRow
            kind="idle"
            agentType={null}
            title="Shell"
            selected={false}
            mirrorKey="tab-1"
            selectionMode={selectionMode}
            onOpen={vi.fn()}
            onPopout={vi.fn()}
            onJump={vi.fn()}
            onClose={vi.fn()}
          />
        </TooltipProvider>
      )
    )
    expect(container.querySelectorAll('button[aria-label="Close terminal"]')).toHaveLength(count)
  })
})

describe('AgentHubPanel row mirror button', () => {
  const rowButton = (label: string): HTMLButtonElement | null =>
    container.querySelector(`[data-agent-hub-row] button[aria-label="${label}"]`)
  const click = (element: Element | null): void => {
    if (!element) {
      throw new Error('nothing to click')
    }
    act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  }

  it('keeps a row click and the pop-out button apart', () => {
    const { handlers } = renderPanel()

    click(rowButton('Pop out'))
    expect(handlers.onPopout).toHaveBeenCalledTimes(1)
    expect(handlers.onOpen).not.toHaveBeenCalled()

    click(container.querySelector('[data-agent-hub-row]'))
    expect(handlers.onOpen).toHaveBeenCalledTimes(1)
    expect(handlers.onPopout).toHaveBeenCalledTimes(1)
  })

  it('offers a close-agent button on a row', () => {
    renderPanel()
    expect(rowButton('Close agent')).not.toBeNull()
    expect(rowButton('Close mirror')).toBeNull()
  })

  it('raises an open owner and restores a parked owner with a close beside it', () => {
    const { handlers } = renderPanel()
    const popOut = rowButton('Pop out')
    click(popOut)
    const [{ target }] = handlers.onPopout.mock.calls[0] ?? []

    act(() => openAgentHubMirror(target))
    // The same button, so the pointer already rests on the next step.
    expect(rowButton('Show in mirror')).toBe(popOut)
    click(popOut)
    expect(readAgentHubMirrors().windows).toHaveLength(1)
    expect(rowButton('Close mirror')).not.toBeNull()

    act(() => minimizeAgentHubMirror(mirrorWindowIdFor(target.paneKey)))
    expect(rowButton('Bring back')).toBe(popOut)
    click(popOut)
    expect(
      readAgentHubMirrors().windows.map((window) => activeAgentHubMirrorTab(window).target)
    ).toEqual([target])

    click(rowButton('Close mirror'))
    expect(readAgentHubMirrors()).toEqual({ windows: [], chips: [] })
    expect(rowButton('Pop out')).toBe(popOut)
  })
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))

describe('AgentHubPanel inbox card', () => {
  function waitingLists(waiting: readonly (readonly [string, number])[]) {
    const repo = makeRepo()
    const worktree = makeWorktree()
    const tabs = ['tab-1', 'tab-2', 'tab-3'].map((id) => makeTabWithIds(id, worktree.id))
    const entries = Object.fromEntries(
      waiting.map(([paneKey, at]) => [
        paneKey,
        {
          state: 'waiting',
          prompt: `Question ${paneKey.slice(0, 5)}`,
          updatedAt: at,
          stateStartedAt: at,
          paneKey,
          terminalTitle: 'Claude',
          stateHistory: [],
          agentType: 'claude'
        } satisfies AgentStatusEntry
      ])
    )
    const threads = makeThreads(
      buildActivityEvents({
        chatNames: new Map(),
        agentStatusByPaneKey: acceptedAgentStatuses(Object.entries(entries)),
        tabsByWorktree: { [worktree.id]: tabs },
        worktreeMap: new Map([[worktree.id, worktree]]),
        repoMap: new Map([[repo.id, repo]]),
        acknowledgedAgentsByPaneKey: {},
        now: 10_000
      })
    )
    return buildAgentHubLists(threads)
  }

  function render(lists: ReturnType<typeof buildAgentHubLists>) {
    const { tree } = fixture()
    act(() => {
      root.render(
        <TooltipProvider>
          <AgentHubPanel
            lists={lists}
            lineage={EMPTY_AGENT_HUB_LINEAGE}
            tree={tree}
            treeOrder={PROJECT_ORDER}
            terminalCount={3}
            locationOf={() => ({ group: null, project: 'Repo', workspace: 'feature' })}
            rootRef={createRef<HTMLDivElement>()}
            onSortChange={vi.fn()}
            onJump={vi.fn()}
            onOpen={vi.fn()}
            onPopout={vi.fn()}
            onPopoutAll={vi.fn()}
            onMarkRead={vi.fn()}
            onClose={vi.fn()}
          />
        </TooltipProvider>
      )
    })
  }

  const shownCard = (): string | null =>
    container
      .querySelector('[data-agent-hub-attention-card]')
      ?.getAttribute('data-agent-hub-attention-card') ?? null

  it('stays on the card being read when an older one sorts in ahead of it', () => {
    render(waitingLists([[PANE_KEY_2, 5_000]]))
    expect(shownCard()).toBe(PANE_KEY_2)

    render(
      waitingLists([
        [PANE_KEY, 1_000],
        [PANE_KEY_2, 5_000]
      ])
    )

    expect(shownCard()).toBe(PANE_KEY_2)
  })

  it('moves to the card now in the same place once the shown one is answered', () => {
    render(
      waitingLists([
        [PANE_KEY, 1_000],
        [PANE_KEY_2, 5_000],
        [PANE_KEY_3, 6_000]
      ])
    )
    expect(shownCard()).toBe(PANE_KEY)

    render(
      waitingLists([
        [PANE_KEY_2, 5_000],
        [PANE_KEY_3, 6_000]
      ])
    )

    expect(shownCard()).toBe(PANE_KEY_2)
  })
})
