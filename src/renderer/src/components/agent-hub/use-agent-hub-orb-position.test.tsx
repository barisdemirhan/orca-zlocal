// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/settings/global-settings-test-fixture'
import { getDefaultFloatingTerminalTriggerPosition } from '../floating-terminal/trigger/floating-terminal-trigger-position'
import { useAgentHubOrbPosition } from './use-agent-hub-orb-position'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { createGlobalSettingsFixture } =
    await import('../../../../shared/settings/global-settings-test-fixture')
  return {
    useAppStore: create(() => ({
      settings: createGlobalSettingsFixture(),
      updateSettings: vi.fn()
    }))
  }
})
beforeEach(() => {
  useAppStore.setState({ settings: createGlobalSettingsFixture() })
  vi.mocked(useAppStore.getState().updateSettings).mockClear()
})
afterEach(cleanup)

it('starts a fresh Orb to the left of the floating terminal toggle with a gap', () => {
  const terminal = getDefaultFloatingTerminalTriggerPosition()
  const { result } = renderHook(useAgentHubOrbPosition)
  expect(terminal.left - result.current.position.x - 48).toBeGreaterThanOrEqual(12)
  expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
})

it('keeps a saved Orb position instead of relocating it beside the terminal toggle', () => {
  useAppStore.setState({
    settings: createGlobalSettingsFixture({ agentHubOrbPosition: { x: 100, y: 120 } })
  })
  const { result } = renderHook(useAgentHubOrbPosition)
  expect(result.current.position).toEqual({ x: 100, y: 120 })
  expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
})
