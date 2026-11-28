// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentHubOrbHistory } from './AgentHubOrbHistory'
import type { AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'

vi.mock('@/lib/agent-session/launch/structured-agent-session-launch-label', () => ({
  structuredAgentLabel: (id: string) => (id === 'codex' ? 'Codex' : 'Claude')
}))
afterEach(cleanup)

function entries(): AgentHubOrbConversation[] {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const older = new Date(now)
  older.setDate(now.getDate() - 4)
  return [
    {
      sessionId: 'today',
      agent: 'codex',
      title: 'Mic worker',
      startedAt: now.getTime(),
      lastActiveAt: now.getTime(),
      lastReply: 'Twelve tests passed'
    },
    {
      sessionId: 'yesterday',
      agent: 'claude',
      title: 'Build progress',
      startedAt: yesterday.getTime(),
      lastActiveAt: yesterday.getTime(),
      lastReply: 'Waiting for review'
    },
    {
      sessionId: 'older',
      agent: 'codex',
      title: 'Release plan',
      startedAt: older.getTime(),
      lastActiveAt: older.getTime()
    }
  ]
}

it('groups local days, marks the active conversation, and filters both titles and replies by agent', () => {
  render(
    <AgentHubOrbHistory
      conversations={entries()}
      activeSessionId="today"
      busy={false}
      onReopen={vi.fn()}
    />
  )
  expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeTruthy()
  expect(screen.getAllByRole('heading')).toHaveLength(3)
  expect(screen.getByRole('button', { name: /Mic worker/ }).getAttribute('aria-current')).toBe(
    'true'
  )
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'REVIEW' } })
  expect(screen.getByRole('button', { name: /Build progress/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Mic worker/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Codex' }))
  expect(screen.getByText('No conversations found')).toBeTruthy()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Mic' } })
  expect(screen.getByRole('button', { name: /Mic worker/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'All agents' }))
  expect(screen.getByRole('button', { name: 'All agents' }).getAttribute('aria-pressed')).toBe(
    'true'
  )
})

it('reopens the selected conversation and disables reopening while a switch is in flight', () => {
  const onReopen = vi.fn()
  const { rerender } = render(
    <AgentHubOrbHistory
      conversations={entries()}
      activeSessionId="today"
      busy={false}
      onReopen={onReopen}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /Build progress/ }))
  expect(onReopen).toHaveBeenCalledWith('yesterday')
  rerender(
    <AgentHubOrbHistory
      conversations={entries()}
      activeSessionId="today"
      busy
      onReopen={onReopen}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /Release plan/ }))
  expect(onReopen).toHaveBeenCalledTimes(1)
})
