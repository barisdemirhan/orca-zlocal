import { expect, it, vi } from 'vitest'
import type { AgentSessionVoiceEvent } from '../../../../shared/agent-session-voice'
import { AgentHubOrbVoicePlayback } from './agent-hub-orb-voice-playback'

const transcript = (
  role: 'user' | 'assistant',
  phase: 'started' | 'delta' | 'done',
  itemId: string,
  hasText = true
): Extract<AgentSessionVoiceEvent, { type: 'transcript' }> => ({
  type: 'transcript',
  sessionId: 'session',
  voiceSessionId: 'voice',
  generation: 1,
  role,
  phase,
  itemId,
  hasText
})

it('holds interrupted output through late deltas and releases for the next spoken input without text', () => {
  const output = vi.fn()
  const playback = new AgentHubOrbVoicePlayback(output)
  playback.accept(transcript('user', 'started', 'input-1', false))
  playback.accept(transcript('assistant', 'started', 'answer-1', false))
  expect(output).toHaveBeenLastCalledWith(true)
  playback.suppress()
  playback.accept(transcript('assistant', 'delta', 'answer-1'))
  playback.accept(transcript('assistant', 'done', 'answer-1'))
  expect(output).toHaveBeenLastCalledWith(false)
  playback.accept(transcript('user', 'started', 'input-2', false))
  playback.accept(transcript('assistant', 'delta', 'answer-1'))
  expect(output).toHaveBeenLastCalledWith(false)
  playback.accept(transcript('assistant', 'started', 'answer-2', false))
  expect(output).toHaveBeenLastCalledWith(true)
  playback.accept(transcript('assistant', 'done', 'answer-2'))
  expect(output).toHaveBeenLastCalledWith(true)
})

it('does not treat a late older input or a preexisting assistant as the new spoken input', () => {
  const output = vi.fn()
  const playback = new AgentHubOrbVoicePlayback(output)
  playback.accept(transcript('user', 'started', 'old-input', false))
  playback.accept(transcript('assistant', 'started', 'old-answer', false))
  playback.suppress()
  playback.accept(transcript('user', 'started', 'new-input', false))
  playback.accept(transcript('user', 'done', 'old-input', false))
  playback.accept(transcript('assistant', 'delta', 'old-answer'))
  expect(output).toHaveBeenLastCalledWith(false)
  playback.accept(transcript('assistant', 'started', 'new-answer', false))
  expect(output).toHaveBeenLastCalledWith(true)
})

it('unmutes on input speech end before any transcript and ignores late text from that speech', () => {
  const output = vi.fn()
  const playback = new AgentHubOrbVoicePlayback(output)
  playback.inputSpeech('started', 'audio-input')
  playback.inputSpeech('stopped', 'audio-input')
  expect(output).toHaveBeenLastCalledWith(true)
  playback.accept(transcript('user', 'started', 'canonical-transcript', false))
  expect(output).toHaveBeenLastCalledWith(true)
  playback.suppress()
  playback.inputSpeech('stopped', 'audio-input')
  playback.accept(transcript('user', 'done', 'canonical-transcript'))
  expect(output).toHaveBeenLastCalledWith(false)
  playback.inputSpeech('started', 'next-audio-input')
  playback.inputSpeech('stopped', 'next-audio-input')
  expect(output).toHaveBeenLastCalledWith(true)
})
