import { describe, expect, it } from 'vitest'
import {
  normalizeAgentHubMicMode,
  normalizeAgentHubAlertOnInfo,
  normalizeAgentHubAnswerQueue
} from './agent-hub-settings'
import { createGlobalSettingsFixture } from './settings/global-settings-test-fixture'
import { normalizeAgentHubOrbIdentitySettings } from './agent-hub-orb-settings'
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

it('keeps info alerts on for older profiles and preserves an explicit opt-out', () => {
  expect(createGlobalSettingsFixture().agentHubAlertOnInfo).toBe(true)
  expect(normalizeAgentHubAlertOnInfo(undefined)).toBe(true)
  expect(normalizeAgentHubAlertOnInfo(true)).toBe(true)
  expect(normalizeAgentHubAlertOnInfo(false)).toBe(false)
})

it('loads older settings with the answer queue off, automatic opening and approvals excluded', () => {
  expect(normalizeAgentHubAnswerQueue({})).toEqual({
    answerQueue: false,
    answerQueueOpening: 'automatically',
    answerQueueIncludeApprovals: false
  })
  expect(normalizeAgentHubAnswerQueue(createGlobalSettingsFixture())).toEqual(
    normalizeAgentHubAnswerQueue({})
  )
  expect(
    normalizeAgentHubAnswerQueue({
      agentHubAnswerQueue: true,
      agentHubAnswerQueueOpening: 'shortcut',
      agentHubAnswerQueueIncludeApprovals: true
    })
  ).toEqual({
    answerQueue: true,
    answerQueueOpening: 'shortcut',
    answerQueueIncludeApprovals: true
  })
})

it('normalizes the Orb identity: trimmed 24-character name, safe defaults, suggestions on', () => {
  expect(normalizeAgentHubOrbIdentitySettings({})).toEqual({
    name: 'Orb',
    tone: 'calm',
    tint: 'silver',
    memorySuggestions: true
  })
  expect(
    normalizeAgentHubOrbIdentitySettings({
      agentHubOrbName: `  ${'x'.repeat(30)}  `,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a stale stored value outside the tone union.
      agentHubOrbTone: 'nope' as never,
      agentHubOrbTint: 'rose',
      agentHubOrbMemorySuggestions: false
    })
  ).toEqual({ name: 'x'.repeat(24), tone: 'calm', tint: 'rose', memorySuggestions: false })
  expect(normalizeAgentHubOrbIdentitySettings({ agentHubOrbName: '   ' }).name).toBe('Orb')
})
