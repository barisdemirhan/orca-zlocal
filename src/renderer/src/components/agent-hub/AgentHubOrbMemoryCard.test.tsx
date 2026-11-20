/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentHubRequest, AgentHubResponse } from '../../../../shared/agent-hub-requests'
import { AgentHubOrbMemoryCard } from './AgentHubOrbMemoryCard'
import { registerAgentHubRequestResponder } from './agent-hub-request-answer'
import { applyAgentHubDelivery, clearAgentHubRequestHost } from './agent-hub-requests-store'
import { orbAsk } from './agent-hub-orb-test-fixtures'

const proposal: Extract<AgentHubRequest, { kind: 'memory' }> = {
  ...orbAsk('orb-session'),
  requestId: 'memory-1',
  kind: 'memory',
  text: 'Prefers short answers'
}
let sent: AgentHubResponse[]
let unregister: () => void

beforeEach(() => {
  sent = []
  unregister = registerAgentHubRequestResponder(async (host, requestId, result) => {
    sent.push(result)
    applyAgentHubDelivery(host, { ...proposal, requestId, kind: 'closed', reason: 'responded' })
  })
  applyAgentHubDelivery('local', proposal)
})
afterEach(() => {
  cleanup()
  unregister()
  clearAgentHubRequestHost('local')
})

it('sends the edited text on Remember, announces the change and keeps a one-line outcome', async () => {
  const changed = vi.fn()
  window.addEventListener('orca:agent-hub-orb-memory-changed', changed)
  render(<AgentHubOrbMemoryCard host="local" sessionId="orb-session" />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Memory text' }), {
    target: { value: 'Prefers short, plain answers' }
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Remember' }))
  })
  expect(sent).toEqual([
    { kind: 'memory', decision: 'remember', text: 'Prefers short, plain answers' }
  ])
  expect(changed).toHaveBeenCalledOnce()
  expect(screen.getByRole('status').textContent).toContain('Added to memory')
  expect(screen.queryByRole('button', { name: 'Remember' })).toBeNull()
  window.removeEventListener('orca:agent-hub-orb-memory-changed', changed)
})

it('declines with the original text and shows nothing for another Orb session', async () => {
  const other = render(<AgentHubOrbMemoryCard host="local" sessionId="elsewhere" />)
  expect(other.container.textContent).toBe('')
  other.unmount()
  render(<AgentHubOrbMemoryCard host="local" sessionId="orb-session" />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
  })
  expect(sent).toEqual([{ kind: 'memory', decision: 'decline', text: 'Prefers short answers' }])
  expect(screen.getByRole('status').textContent).toContain("Won't remember")
})
