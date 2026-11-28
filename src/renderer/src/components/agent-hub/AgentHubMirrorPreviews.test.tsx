/** @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import type { AgentHubMirrorWindowState } from './agent-hub-mirror-membership'
import { AgentHubMirrorPreviews } from './AgentHubMirrorPreviews'

const lifecycle = vi.hoisted(() => {
  const mounted: string[] = []
  const unmounted: string[] = []
  return { mounted, unmounted }
})
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({})) }
})
vi.mock('./use-agent-hub-live-pty', () => ({
  useAgentHubLivePty: (_workspace: string, tab: string) => tab
}))
vi.mock('./agent-hub-pane-target', () => ({ resolveAgentHubTerminalInput: () => null }))
vi.mock('../dashboard/terminal-preview/AgentTerminalPreview', async () => {
  const { useEffect } = await import('react')
  return {
    AgentTerminalPreview: ({
      ptyId,
      visible,
      focusOnActivate
    }: {
      ptyId: string
      visible: boolean
      focusOnActivate: boolean
    }) => {
      useEffect(() => {
        lifecycle.mounted.push(ptyId)
        return () => {
          lifecycle.unmounted.push(ptyId)
        }
      }, [ptyId])
      return <output data-pty={ptyId} data-visible={visible} data-focus={focusOnActivate} />
    }
  }
})
afterEach(() => {
  cleanup()
  lifecycle.mounted.length = 0
  lifecycle.unmounted.length = 0
})
function fixture(): AgentHubMirrorWindowState {
  const worktree = { ...makeWorktree(), id: FLOATING_TERMINAL_WORKTREE_ID }
  return {
    id: 'window',
    activeTabId: 'one',
    tabs: ['one', 'two'].map((id) => ({
      id,
      origin: 'manual',
      target: {
        worktree,
        repo: null,
        tab: makeTabWithIds(id, worktree.id),
        paneKey: null,
        title: id,
        agentType: null
      }
    }))
  }
}
it('retains visited floating previews across selection and refits only the visible entry', () => {
  const window = fixture()
  const view = render(<AgentHubMirrorPreviews windows={[window]} slots={new Map()} visible />)
  const first = view.container.querySelector('[data-pty="one"]')
  expect(lifecycle.mounted).toEqual(['one'])
  view.rerender(
    <AgentHubMirrorPreviews
      windows={[{ ...window, activeTabId: 'two' }]}
      slots={new Map()}
      visible
    />
  )
  expect(view.container.querySelector('[data-pty="one"]')).toBe(first)
  expect(first?.getAttribute('data-visible')).toBe('false')
  expect(first?.parentElement?.hidden).toBe(true)
  expect(lifecycle.mounted).toEqual(['one', 'two'])
  view.rerender(<AgentHubMirrorPreviews windows={[window]} slots={new Map()} visible />)
  expect(view.container.querySelector('[data-pty="one"]')).toBe(first)
  expect(lifecycle.unmounted).toEqual([])
  expect(first?.getAttribute('data-visible')).toBe('true')
  expect(first?.getAttribute('data-focus')).toBe('false')
  view.rerender(<AgentHubMirrorPreviews windows={[window]} slots={new Map()} visible={false} />)
  expect(view.container.querySelectorAll('[data-visible="true"]')).toHaveLength(0)
  expect(lifecycle.unmounted).toEqual([])
})
it('releases only a removed entry and does not build previews for workspace terminals', () => {
  const window = fixture()
  const view = render(<AgentHubMirrorPreviews windows={[window]} slots={new Map()} visible />)
  view.rerender(
    <AgentHubMirrorPreviews
      windows={[{ ...window, activeTabId: 'two' }]}
      slots={new Map()}
      visible
    />
  )
  view.rerender(
    <AgentHubMirrorPreviews
      windows={[{ ...window, activeTabId: 'two', tabs: window.tabs.slice(1) }]}
      slots={new Map()}
      visible
    />
  )
  expect(lifecycle.unmounted).toEqual(['one'])
  const workspaceWindow = {
    ...window,
    tabs: window.tabs.map((entry) => ({
      ...entry,
      target: { ...entry.target, worktree: makeWorktree() }
    }))
  }
  view.rerender(<AgentHubMirrorPreviews windows={[workspaceWindow]} slots={new Map()} visible />)
  expect(view.container.querySelectorAll('[data-pty]')).toHaveLength(0)
  expect(lifecycle.mounted).toEqual(['one', 'two'])
})

it('keeps the same preview owner and DOM container while its entry moves between windows', () => {
  const window = fixture()
  const first = document.createElement('div'),
    second = document.createElement('div')
  document.body.append(first, second)
  const slots = new Map([
    ['window', first],
    ['destination', second]
  ])
  const view = render(<AgentHubMirrorPreviews windows={[window]} slots={slots} visible />)
  const terminal = first.querySelector('[data-pty="one"]')
  expect(terminal).not.toBeNull()
  view.rerender(
    <AgentHubMirrorPreviews
      windows={[
        { ...window, tabs: window.tabs.slice(1), activeTabId: 'two' },
        { id: 'destination', tabs: window.tabs.slice(0, 1), activeTabId: 'one' }
      ]}
      slots={slots}
      visible
    />
  )
  expect(second.querySelector('[data-pty="one"]')).toBe(terminal)
  expect(lifecycle.mounted).toEqual(['one', 'two'])
  expect(lifecycle.unmounted).toEqual([])
  view.unmount()
  first.remove()
  second.remove()
})
