/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render } from '@testing-library/react'
import { useAppStore } from '@/store'
import { TooltipProvider } from '../ui/tooltip'
import { PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { AgentHubAlertStack } from './AgentHubAlertStack'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      settings: {},
      keybindings: {},
      activeView: 'terminal',
      activeWorktreeId: null
    }))
  }
})
afterEach(cleanup)

it('marks an alert as current only while its workspace is the open one', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    }
  )
  const thread = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1000 }])[0]
  render(
    <TooltipProvider>
      <AgentHubAlertStack
        alerts={[{ id: 'a', kind: 'done', thread }]}
        anchorRef={{ current: document.body }}
        side="top"
        locationOf={() => ({ group: null, project: 'Project', workspace: null })}
        onOpen={vi.fn()}
        onPopout={vi.fn()}
        onJump={vi.fn()}
        onDismiss={vi.fn()}
      />
    </TooltipProvider>
  )
  const content = (): string | null | undefined =>
    document.querySelector('[data-agent-hub-alert] [data-current]')?.getAttribute('data-current')
  expect(content()).toBe('false')
  act(() => useAppStore.setState({ activeWorktreeId: thread.worktree.id }))
  expect(content()).toBe('true')
  act(() => useAppStore.setState({ activeView: 'tasks' }))
  expect(content()).toBe('false')
})
