/** @vitest-environment happy-dom */
import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentHubPanel } from './AgentHubPanel'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { buildAgentHubLists } from './agent-hub-lists'
import { registerAgentHubRequestResponder } from './agent-hub-request-answer'
import {
  agentHubRequestKey,
  applyAgentHubDelivery,
  clearAgentHubRequestHost,
  readAgentHubRequests
} from './agent-hub-requests-store'
import { agentHubAskRequest } from './agent-hub-request-test-fixtures'
import type { AgentHubResponse } from '../../../../shared/agent-hub-requests'

const respond = vi.fn<(host: string, id: string, result: AgentHubResponse) => Promise<void>>()
let unregister: () => void
beforeEach(() => {
  vi.useFakeTimers()
  respond.mockReset().mockResolvedValue(undefined)
  unregister = registerAgentHubRequestResponder(respond)
})
afterEach(() => {
  cleanup()
  unregister()
  for (const host of readAgentHubRequests().keys()) {
    clearAgentHubRequestHost(host)
  }
  vi.useRealTimers()
})

it('opens the requested host card, preserves its draft and focus across arrivals, and updates Inbox counts on closure', async () => {
  const first = agentHubAskRequest({ requestId: 'first', question: 'First question', createdAt: 1 })
  const second = agentHubAskRequest({
    requestId: 'second',
    question: 'Second question',
    createdAt: 2
  })
  applyAgentHubDelivery('local', first)
  applyAgentHubDelivery('workhost', second)
  const rootRef = createRef<HTMLDivElement>()
  render(
    <TooltipProvider>
      <AgentHubPanel
        lists={buildAgentHubLists([])}
        lineage={EMPTY_AGENT_HUB_LINEAGE}
        tree={[]}
        treeOrder={{ sortBy: 'repo', workspaceRank: new Map(), now: 0 }}
        terminalCount={0}
        rootRef={rootRef}
        initialPaneKey={agentHubRequestKey('workhost', second.requestId)}
        locationOf={() => ({ group: null, project: 'Orca', workspace: 'feature' })}
        requestPresentationOf={(host) => ({
          title: 'Worker',
          targetTitle: 'Worker',
          target: null,
          location: { group: null, project: 'Orca', workspace: 'feature', host }
        })}
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
  expect(screen.getByText('Second question')).toBeTruthy()
  expect(screen.getByRole('tab', { name: /^Inbox/ }).textContent).toBe('Inbox2')
  const input = screen.getByRole('textbox', { name: 'Reply to @claude…' })
  input.focus()
  fireEvent.change(input, { target: { value: 'Draft stays here' } })
  act(() => {
    applyAgentHubDelivery(
      'local',
      agentHubAskRequest({ requestId: 'earlier', question: 'Earlier question', createdAt: 0 })
    )
    vi.advanceTimersByTime(401)
  })
  expect(screen.getByText('Second question')).toBeTruthy()
  expect(document.activeElement).toBe(input)
  expect(input.getAttribute('value')).toBe('Draft stays here')
  expect(screen.getByRole('tab', { name: /^Inbox/ }).textContent).toBe('Inbox3')
  fireEvent.keyDown(input, { key: '1' })
  expect(respond).not.toHaveBeenCalled()
  const root = rootRef.current
  if (!root) {
    throw new Error('Inbox root missing')
  }
  root.focus()
  await act(async () => fireEvent.keyDown(root, { key: '2' }))
  expect(respond).toHaveBeenCalledWith('workhost', second.requestId, {
    kind: 'ask',
    answer: 'Second',
    index: 2
  })
  act(() => applyAgentHubDelivery('workhost', { ...second, kind: 'closed', reason: 'responded' }))
  expect(screen.queryByText('Second question')).toBeNull()
  expect(screen.getByRole('tab', { name: /^Inbox/ }).textContent).toBe('Inbox2')
})
