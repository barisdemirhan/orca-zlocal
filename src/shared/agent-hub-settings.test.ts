import { describe, expect, it } from 'vitest'
import { normalizeAgentHubMicMode } from './agent-hub-settings'
import { createGlobalSettingsFixture } from './global-settings-test-fixture'
describe('mirror microphone default mode', () => {
  it.each([undefined, null, '', 'unknown', true, 1, {}, 'dictate'])(
    'defaults invalid or missing mode %j to plain dictation',
    (value) => {
      expect(normalizeAgentHubMicMode(value)).toBe('dictate')
    }
  )
  it('preserves explicit improvement for capable controllers', () => {
    expect(normalizeAgentHubMicMode('improve')).toBe('improve')
  })
})

it('lets agents control Agent Hub by default while keeping the experiment opt-in', () => {
  const settings = createGlobalSettingsFixture()
  expect(settings.agentHubAgentControl).toBe(true)
  expect(settings.experimentalAgentHub).toBe(false)
})
