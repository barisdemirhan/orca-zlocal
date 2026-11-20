// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { agentHubOrbVoiceStartFailure } from './agent-hub-orb-voice-failure'

it.each([
  'This Codex version does not support Live voice.',
  'Codex Live voice is unavailable because an account usage limit was reached.',
  'Codex refused Live voice. Check the current account and workspace access.',
  'Codex Live voice could not connect. Try again after the connection has closed.'
])('preserves the sanitized Codex start category: %s', (message) => {
  expect(agentHubOrbVoiceStartFailure(new Error(message))).toEqual({
    reason: message,
    mediaUnsupported: false
  })
})

it.each([
  'Untrusted provider diagnostic v=0\r\nm=audio secret-sdp',
  'This Codex version does not support Live voice. v=0\r\nm=audio secret-sdp',
  'account quota v=0\r\nm=audio secret-sdp',
  'Codex Live voice could not connect. Try again after the connection has closed. secret'
])('keeps unrecognized provider errors private: %s', (message) => {
  expect(agentHubOrbVoiceStartFailure(new Error(message))).toEqual({
    reason: 'Live voice could not connect. Try again.',
    mediaUnsupported: false
  })
})
