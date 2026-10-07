/** @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
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
vi.mock('../dashboard-popout/AgentTerminalPreview', async () => {
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
  const view = render(<AgentHubMirrorPreviews window={window} visible />)
  const first = view.container.querySelector('[data-pty="one"]')
  expect(lifecycle.mounted).toEqual(['one'])
  view.rerender(<AgentHubMirrorPreviews window={{ ...window, activeTabId: 'two' }} visible />)
  expect(view.container.querySelector('[data-pty="one"]')).toBe(first)
  expect(first?.getAttribute('data-visible')).toBe('false')
  expect(first?.parentElement?.hidden).toBe(true)
  expect(lifecycle.mounted).toEqual(['one', 'two'])
  view.rerender(<AgentHubMirrorPreviews window={window} visible />)
  expect(view.container.querySelector('[data-pty="one"]')).toBe(first)
  expect(lifecycle.unmounted).toEqual([])
  expect(first?.getAttribute('data-visible')).toBe('true')
  expect(first?.getAttribute('data-focus')).toBe('false')
  view.rerender(<AgentHubMirrorPreviews window={window} visible={false} />)
  expect(view.container.querySelectorAll('[data-visible="true"]')).toHaveLength(0)
  expect(lifecycle.unmounted).toEqual([])
})
it('releases only a removed entry and does not build previews for workspace terminals', () => {
  const window = fixture()
  const view = render(<AgentHubMirrorPreviews window={window} visible />)
  view.rerender(<AgentHubMirrorPreviews window={{ ...window, activeTabId: 'two' }} visible />)
  view.rerender(
    <AgentHubMirrorPreviews
      window={{ ...window, activeTabId: 'two', tabs: window.tabs.slice(1) }}
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
  view.rerender(<AgentHubMirrorPreviews window={workspaceWindow} visible />)
  expect(view.container.querySelectorAll('[data-pty]')).toHaveLength(0)
  expect(lifecycle.mounted).toEqual(['one', 'two'])
})
