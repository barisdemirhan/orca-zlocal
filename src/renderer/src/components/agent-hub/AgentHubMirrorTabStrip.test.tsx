/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as MirrorSource from './agent-hub-mirror-source'
import { AgentHubMirrorTabStrip } from './AgentHubMirrorTabStrip'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import {
  openAgentHubMirror,
  useAgentHubMirrors,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  commitAgentHubMirrorState
} from './agent-hub-mirror-store'
import {
  requestAgentHubMirrorSelection,
  useAgentHubMirrorSelection
} from './agent-hub-mirror-selection'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ tabsByWorktree: {} })) }
})
vi.mock('./AgentHubMirrorAddButton', () => ({
  AgentHubMirrorAddButton: ({ count }: { count: number }) => (
    <button disabled={count === 10}>Add</button>
  )
}))
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  vi.restoreAllMocks()
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
function stage(count = 3) {
  openAgentHubMirror(target('one'))
  const id = readAgentHubMirrors().windows[0]?.id
  if (!id) {
    throw new Error('No window')
  }
  for (let i = 1; i < count; i++) {
    addAgentHubMirrorTab(id, target(`entry-${i}`))
  }
  function Stage(): React.JSX.Element {
    const { windows } = useAgentHubMirrors()
    const selection = useAgentHubMirrorSelection()
    return (
      <TooltipProvider>
        <output data-testid="focus-policy">{String(selection.focusTerminal)}</output>
        {windows.map((window) => (
          <AgentHubMirrorTabStrip
            key={window.id}
            window={window}
            threads={[]}
            lineage={EMPTY_AGENT_HUB_LINEAGE}
          />
        ))}
      </TooltipProvider>
    )
  }
  render(<Stage />)
  return id
}
it('keeps a singleton tablist and add affordance, and reserves a shrinking scroll strip', () => {
  stage(1)
  expect(screen.getAllByRole('tab')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy()
  const tablist = screen.getByRole('tablist')
  expect(tablist.className).toContain('overflow-x-auto')
  expect(screen.getByRole('tab').parentElement?.className).toContain('min-w-40')
})
it('roves Left/Right/Home/End while preserving strip focus, and Enter requests terminal focus', () => {
  stage()
  const tabs = screen.getAllByRole('tab')
  const last = tabs.at(-1)
  if (!last) {
    throw new Error('No tab')
  }
  last.focus()
  fireEvent.keyDown(last, { key: 'Home' })
  expect(document.activeElement).toBe(tabs[0])
  expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
  expect(screen.getByTestId('focus-policy').textContent).toBe('false')
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowLeft' })
  expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(tabs[0])
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'End' })
  expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'Enter' })
  expect(screen.getByTestId('focus-policy').textContent).toBe('true')
  expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
})
it('does not reveal the active tab during passive renders', () => {
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
  const id = stage()
  const before = scroll.mock.calls.length
  act(() => commitAgentHubMirrorState(readAgentHubMirrors()))
  act(() =>
    requestAgentHubMirrorSelection(
      id,
      readAgentHubMirrors().windows[0]?.activeTabId ?? '',
      false,
      false
    )
  )
  expect(scroll.mock.calls.length).toBe(before)
})
it('returns inactive entries home and removes the final window without terminal destruction', () => {
  stage()
  const active = readAgentHubMirrors().windows[0]?.activeTabId
  fireEvent.click(screen.getByRole('button', { name: 'Return one to workspace' }))
  expect(readAgentHubMirrors().windows[0]?.activeTabId).toBe(active)
  fireEvent.click(screen.getByRole('button', { name: 'Return entry-2 to workspace' }))
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.title).toBe('entry-1')
  fireEvent.click(screen.getByRole('button', { name: 'Return entry-1 to workspace' }))
  expect(readAgentHubMirrors().windows).toHaveLength(0)
})
it('disables the add affordance at ten entries and refuses another addition', () => {
  const id = stage(10)
  expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true)
  expect(addAgentHubMirrorTab(id, target('eleven'))).toEqual({ status: 'tab-cap' })
  expect(screen.getAllByRole('tab')).toHaveLength(10)
})

it('returns a keyboard-closed tab home and keeps focus on its surviving neighbour', async () => {
  stage()
  const user = userEvent.setup()
  const active = screen.getByRole('tab', { name: 'entry-2, idle' })
  active.focus()
  await user.keyboard('{Shift>}{F10}{/Shift}')
  await user.keyboard('{ArrowDown}{Enter}')
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  const neighbour = screen.getByRole('tab', { name: 'entry-1, idle' })
  expect(neighbour.getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(neighbour)
  expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
})
