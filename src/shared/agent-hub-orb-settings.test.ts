import { describe, expect, it } from 'vitest'
import { normalizeAgentHubOrbSettings } from './agent-hub-orb-settings'
import { createGlobalSettingsFixture } from './global-settings-test-fixture'

describe('Orb settings', () => {
  it('keeps absent saved fields compatible with the shipped defaults', () => {
    expect(normalizeAgentHubOrbSettings({})).toEqual({
      agent: 'claude',
      model: null,
      permission: 'ask',
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
})
