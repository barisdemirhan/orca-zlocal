/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { AgentHubAlertSettings } from './AgentHubAlertSettings'
import { useAgentHubPreferences } from './use-agent-hub-settings'

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/testing/app-store-test-fixture')
  return { useAppStore: createTestStore() }
})
afterEach(cleanup)

it('persists the opt-in and reveals automatic opening and approvals controls with safe defaults', () => {
  useAppStore.setState({ settings: getDefaultSettings('/home/u') })
  const update = vi.fn((changes: Partial<GlobalSettings>) => {
    const current = useAppStore.getState().settings
    if (current) {
      useAppStore.setState({ settings: { ...current, ...changes } })
    }
  })
  function Settings() {
    return <AgentHubAlertSettings preferences={useAgentHubPreferences()} updateSettings={update} />
  }
  render(<Settings />)
  expect(screen.queryByText('Include approvals')).toBeNull()
  fireEvent.click(screen.getByRole('switch', { name: 'Answer queue' }))
  expect(update).toHaveBeenLastCalledWith({ agentHubAnswerQueue: true })
  expect(screen.getByText('Automatically')).toBeTruthy()
  const approvals = screen.getByRole('switch', { name: 'Include approvals' })
  expect(approvals.getAttribute('aria-checked')).toBe('false')
  fireEvent.click(approvals)
  expect(update).toHaveBeenLastCalledWith({ agentHubAnswerQueueIncludeApprovals: true })
})
