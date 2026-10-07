/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { AgentHubMirrorTabMenu } from './AgentHubMirrorTabMenu'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  minimizeAgentHubMirror
} from './agent-hub-mirror-store'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
const feedback = vi.hoisted(() => vi.fn())
vi.mock('./agent-hub-mirror-transfer-feedback', () => ({ mirrorTabTransferFeedback: feedback }))

vi.mock('./agent-hub-mirror-source', () => ({
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
function open(title: string) {
  const worktree = makeWorktree()
  openAgentHubMirror({
    worktree,
    repo: null,
    tab: makeTabWithIds(title, worktree.id),
    paneKey: null,
    title,
    agentType: null
  })
  return readAgentHubMirrors().windows.at(-1)!
}
it('offers Open in new mirror through the context menu and preserves the source terminal identity', () => {
  const source = open('source')
  addAgentHubMirrorTab(source.id, {
    ...source.tabs[0]!.target,
    tab: makeTabWithIds('other', source.tabs[0]!.target.worktree.id)
  })
  const onClose = vi.fn()
  render(
    <AgentHubMirrorTabMenu windowId={source.id} entryId={source.tabs[0]!.id} onClose={onClose}>
      <button>Terminal tab</button>
    </AgentHubMirrorTabMenu>
  )
  fireEvent.contextMenu(screen.getByText('Terminal tab'))
  expect(screen.getByText('Move to mirror').getAttribute('data-disabled')).toBe('')
  fireEvent.click(screen.getByText('Open in new mirror'))
  expect(readAgentHubMirrors().windows).toHaveLength(2)
  expect(readAgentHubMirrors().windows.at(-1)?.tabs[0]?.id).toBe(source.tabs[0]!.id)
  expect(onClose).not.toHaveBeenCalled()
})
it('lists visible destination windows and routes submenu selection through the same atomic move', async () => {
  const source = open('source'),
    destination = open('destination')
  const user = userEvent.setup()
  render(
    <AgentHubMirrorTabMenu windowId={source.id} entryId={source.tabs[0]!.id} onClose={vi.fn()}>
      <button>Terminal tab</button>
    </AgentHubMirrorTabMenu>
  )
  await user.pointer({ target: screen.getByText('Terminal tab'), keys: '[MouseRight]' })
  const submenu = screen.getByText('Move to mirror')
  await user.hover(submenu)
  const item = await screen.findByText('destination')
  const row = item.closest<HTMLElement>('[role="menuitem"]')!
  expect(row.getAttribute('data-disabled')).toBeNull()
  expect(row.isConnected).toBe(true)
  await act(async () => {
    fireEvent.click(row)
  })
  expect(feedback.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'changed' })
  await waitFor(() => expect(readAgentHubMirrors().windows).toHaveLength(1))
  expect(readAgentHubMirrors().windows[0]?.id).toBe(destination.id)
  expect(readAgentHubMirrors().windows[0]?.activeTabId).toBe(source.tabs[0]!.id)
})

it('excludes parked destinations and explains why a ten-tab destination is unavailable', async () => {
  const source = open('source'),
    destination = open('full destination'),
    parked = open('parked destination')
  minimizeAgentHubMirror(parked.id)
  for (let i = 0; i < 9; i += 1) {
    addAgentHubMirrorTab(destination.id, {
      ...destination.tabs[0]!.target,
      title: 'full destination',
      tab: makeTabWithIds(`extra-${i}`, destination.tabs[0]!.target.worktree.id)
    })
  }
  const before = readAgentHubMirrors()
  const user = userEvent.setup()
  render(
    <AgentHubMirrorTabMenu windowId={source.id} entryId={source.tabs[0]!.id} onClose={vi.fn()}>
      <button>Terminal tab</button>
    </AgentHubMirrorTabMenu>
  )
  await user.pointer({ target: screen.getByText('Terminal tab'), keys: '[MouseRight]' })
  await user.hover(screen.getByText('Move to mirror'))
  const item = await screen.findByText('full destination')
  const row = item.closest<HTMLElement>('[role="menuitem"]')!
  expect(row.getAttribute('data-disabled')).toBe('')
  expect(row.title).toBe('A mirror can hold up to 10 terminals.')
  expect(screen.queryByText('parked destination')).toBeNull()
  fireEvent.click(row)
  expect(readAgentHubMirrors()).toBe(before)
  expect(feedback).not.toHaveBeenCalled()
})
