import { describe, expect, it } from 'vitest'
import {
  agentHubOrbChosenMode,
  agentHubOrbOfferedModes,
  agentHubOrbPermissionSettingValue,
  normalizeAgentHubOrbSettings,
  resolveAgentHubOrbMode
} from './agent-hub-orb-settings'
import { createGlobalSettingsFixture } from './global-settings-test-fixture'

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
    ['codex', true, 'auto'],
    ['claude', true, 'auto'],
    ['claude', false, 'full-access'],
    ['grok', false, 'full-access'],
    ['pi', false, null]
  ] as const)('defaults %s (auto supported: %s) to %s when never chosen', (agent, auto, mode) => {
    expect(resolveAgentHubOrbMode(agent, null, auto)).toBe(mode)
  })

  it('keeps an explicit choice, and never grants more than the agent offers', () => {
    expect(resolveAgentHubOrbMode('codex', 'ask', true)).toBe('ask')
    expect(resolveAgentHubOrbMode('codex', 'full-access', true)).toBe('full-access')
    expect(resolveAgentHubOrbMode('grok', 'auto', true)).toBe('ask')
    expect(resolveAgentHubOrbMode('claude', 'auto', false)).toBe('ask')
  })

  it('offers the modes the agent supports', () => {
    expect(agentHubOrbOfferedModes('codex', true)).toEqual(['ask', 'auto', 'full-access'])
    expect(agentHubOrbOfferedModes('claude', false)).toEqual(['ask', 'accept-edits', 'full-access'])
    expect(agentHubOrbOfferedModes('pi', false)).toEqual(['full-access'])
  })
})
