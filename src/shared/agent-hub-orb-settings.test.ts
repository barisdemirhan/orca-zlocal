import { describe, expect, it } from 'vitest'
import {
  agentHubOrbChosenMode,
  agentHubOrbPermissionSettingValue,
  normalizeAgentHubOrbSettings,
  resolveAgentHubOrbMode
} from './agent-hub-orb-settings'
import { createGlobalSettingsFixture } from './settings/global-settings-test-fixture'

describe('Orb settings', () => {
  it('keeps absent saved fields compatible with the shipped defaults', () => {
    expect(normalizeAgentHubOrbSettings({})).toEqual({
      agent: 'claude',
      model: null,
      permission: null,
      cwd: null
    })
    expect(normalizeAgentHubOrbSettings(createGlobalSettingsFixture())).toEqual(
      normalizeAgentHubOrbSettings({})
    )
  })

  it('preserves the selected agent and normalizes its optional model', () => {
    expect(
      normalizeAgentHubOrbSettings({
        agentHubOrbAgent: 'codex',
        agentHubOrbModel: '  gpt-live  ',
        agentHubOrbPermission: 'ask',
        agentHubOrbCwd: ' /selected/folder '
      })
    ).toEqual({
      agent: 'codex',
      model: 'gpt-live',
      permission: 'ask',
      cwd: '/selected/folder'
    })
    expect(normalizeAgentHubOrbSettings({ agentHubOrbModel: '   ' })).toMatchObject({ model: null })
  })

  it('reads the stored names without losing a legacy Act freely choice', () => {
    expect(agentHubOrbChosenMode('free')).toBe('full-access')
    expect(agentHubOrbChosenMode('ask')).toBe('ask')
    expect(agentHubOrbChosenMode('auto')).toBe('auto')
    expect(agentHubOrbChosenMode(undefined)).toBeNull()
    expect(agentHubOrbChosenMode('anything')).toBeNull()
    expect(agentHubOrbPermissionSettingValue('full-access')).toBe('free')
    expect(agentHubOrbPermissionSettingValue('auto')).toBe('auto')
  })

  it.each([
    ['codex', 'auto'],
    ['claude', 'auto'],
    ['grok', 'ask'],
    ['pi', null]
  ] as const)('defaults %s to %s when never chosen', (agent, mode) => {
    expect(resolveAgentHubOrbMode(agent, null)).toBe(mode)
  })

  it('keeps an explicit choice, and never grants more than the agent offers', () => {
    expect(resolveAgentHubOrbMode('codex', 'ask')).toBe('ask')
    expect(resolveAgentHubOrbMode('codex', 'full-access')).toBe('full-access')
    expect(resolveAgentHubOrbMode('grok', 'auto')).toBe('ask')
  })
})
