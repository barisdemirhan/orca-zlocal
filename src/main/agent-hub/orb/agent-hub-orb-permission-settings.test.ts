import { expect, it } from 'vitest'
import {
  agentHubOrbPermissionMode,
  agentHubOrbPermissionOptions
} from './agent-hub-orb-permission-settings'
import { createGlobalSettingsFixture } from '../../../shared/global-settings-test-fixture'

it.each([
  ['ask', 'ask'],
  ['free', 'full-access']
] as const)('maps Orb %s to the chat permission mode %s', (permission, mode) => {
  const settings = createGlobalSettingsFixture({ agentHubOrbPermission: permission })
  for (const agent of ['claude', 'codex', 'grok']) {
    expect(agentHubOrbPermissionMode(settings, agent)).toBe(mode)
    expect(agentHubOrbPermissionOptions(settings, agent)).toEqual({ permissionMode: mode })
  }
})

it('sets no mode for an agent whose chats offer none', () => {
  const settings = createGlobalSettingsFixture({ agentHubOrbPermission: 'free' })
  expect(agentHubOrbPermissionMode(settings, 'pi')).toBeNull()
  expect(agentHubOrbPermissionOptions(settings, 'pi')).toEqual({})
})

it('defaults a never-chosen Orb to Approve for me, else Full access', () => {
  const settings = createGlobalSettingsFixture()
  expect(agentHubOrbPermissionMode(settings, 'codex', true)).toBe('auto')
  expect(agentHubOrbPermissionMode(settings, 'claude', true)).toBe('auto')
  expect(agentHubOrbPermissionMode(settings, 'claude', false)).toBe('full-access')
  expect(agentHubOrbPermissionOptions(settings, 'grok')).toEqual({
    permissionMode: 'full-access'
  })
})

it('keeps an explicit choice over the default', () => {
  const settings = createGlobalSettingsFixture({
    agentHubOrbPermission: 'ask'
  })
  expect(agentHubOrbPermissionMode(settings, 'codex', true)).toBe('ask')
  expect(
    agentHubOrbPermissionMode(
      createGlobalSettingsFixture({ agentHubOrbPermission: 'auto' }),
      'codex'
    )
  ).toBe('auto')
})
