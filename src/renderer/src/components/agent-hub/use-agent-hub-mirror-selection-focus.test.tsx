/** @vitest-environment happy-dom */
import { useRef } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import { useAgentHubMirrorSelectionFocus } from './use-agent-hub-mirror-selection-focus'
import { requestAgentHubMirrorSelection } from './agent-hub-mirror-selection'

afterEach(cleanup)
function Stage({ tabId, allowed = true }: { tabId: string; allowed?: boolean }) {
  const rootRef = useRef<HTMLElement>(null)
  const worktree = makeWorktree()
  const target = {
    worktree,
    repo: null,
    tab: makeTabWithIds(tabId, worktree.id),
    paneKey: `${tabId}:leaf`,
    title: tabId,
    agentType: null
  }
  useAgentHubMirrorSelectionFocus({
    windowId: 'window',
    tabId,
    target,
    rootRef,
    allowed,
    preview: false
  })
  return <section ref={rootRef} data-testid="slot" />
}
function attach(root: HTMLElement, tabId: string): HTMLTextAreaElement {
  const container = document.createElement('div')
  container.dataset.terminalTabId = tabId
  const pane = document.createElement('div')
  pane.className = 'pane'
  pane.dataset.leafId = 'leaf'
  const input = document.createElement('textarea')
  input.className = 'xterm-helper-textarea'
  pane.append(input)
  container.append(pane)
  root.append(container)
  return input
}
it('waits for the exact identity to attach and ignores a late previous target', async () => {
  const view = render(<Stage tabId="a" />)
  act(() => requestAgentHubMirrorSelection('window', 'a'))
  view.rerender(<Stage tabId="b" />)
  act(() => requestAgentHubMirrorSelection('window', 'b'))
  const root = view.getByTestId('slot')
  const late = attach(root, 'a')
  const lateFocus = vi.spyOn(late, 'focus')
  const current = attach(root, 'b')
  await waitFor(() => expect(document.activeElement).toBe(current))
  expect(lateFocus).not.toHaveBeenCalled()
})
it('does not take focus for chrome navigation, hidden/hub restore, or later passive attachment', async () => {
  const view = render(<Stage tabId="a" allowed={false} />)
  const search = document.createElement('input')
  document.body.append(search)
  search.focus()
  act(() => requestAgentHubMirrorSelection('window', 'a'))
  view.rerender(<Stage tabId="a" allowed />)
  attach(view.getByTestId('slot'), 'a')
  act(() => requestAgentHubMirrorSelection('window', 'a', false))
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(document.activeElement).toBe(search)
  search.remove()
})

it('leaves a newly focused external input alone when terminal attachment finishes late', async () => {
  const view = render(<Stage tabId="a" />)
  act(() => requestAgentHubMirrorSelection('window', 'a'))
  const search = document.createElement('input')
  document.body.append(search)
  search.focus()
  attach(view.getByTestId('slot'), 'a')
  await new Promise((resolve) => setTimeout(resolve, 40))
  expect(document.activeElement).toBe(search)
  search.remove()
})
