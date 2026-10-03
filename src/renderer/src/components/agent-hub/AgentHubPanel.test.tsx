// @vitest-environment happy-dom

import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { buildActivityEvents } from '../activity/activity-event-builder'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree,
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3
} from '../activity/ActivityPrototypePage-test-fixtures'
import { AgentHubPanel } from './AgentHubPanel'
import { buildAgentHubLists } from './agent-hub-lists'
import { buildAgentHubTerminalTree } from './agent-hub-terminal-tree'

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
      agentStatusByPaneKey: {
        [PANE_KEY]: entry(PANE_KEY, 'working', 3_000),
        [PANE_KEY_2]: entry(PANE_KEY_2, 'done', 1_000),
        [PANE_KEY_3]: entry(PANE_KEY_3, 'done', 2_000)
      },
      retainedAgentsByPaneKey: {},
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
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Unknown'
  })
  return { lists: buildAgentHubLists(threads), tree }
}

function renderPanel() {
  const { lists, tree } = fixture()
  const handlers = { onJump: vi.fn(), onPopout: vi.fn(), onMarkRead: vi.fn() }
  const rootRef = createRef<HTMLDivElement>()
  act(() => {
    root.render(
      <TooltipProvider>
        <AgentHubPanel
          lists={lists}
          tree={tree}
          terminalCount={3}
          locationOf={() => 'Repo · feature'}
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
    expect(container.querySelector('[role="tab"][data-state="active"]')?.textContent).toContain(
      'Running'
    )
    press(panel.current, 'ArrowDown')
    press(panel.current, 'Enter')
    expect(handlers.onJump.mock.calls[0]?.[0].thread.paneKey).toBe(PANE_KEY)
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
