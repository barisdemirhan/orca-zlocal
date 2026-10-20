import { describe, expect, it } from 'vitest'
import { OrbDictationHold } from './agent-hub-orb-dictation-hold'

function liveVoice(input: 'listening' | 'muted' = 'listening', outputMuted = false) {
  const voice = {
    snapshot: { connection: 'live' as const, input, outputMuted },
    spoke: true,
    muteInput: (muted: boolean) => {
      voice.snapshot = { ...voice.snapshot, input: muted ? 'muted' : 'listening' }
    },
    muteOutput: (muted: boolean) => {
      voice.snapshot = { ...voice.snapshot, outputMuted: muted }
    },
    stopSpeaking: () => {
      voice.spoke = false
    }
  }
  return voice
}

describe('Orb dictation hold', () => {
  it('mutes Live and stops its speech for a dictation, then restores it', () => {
    const voice = liveVoice()
    const hold = new OrbDictationHold(voice)
    hold.update(voice.snapshot, true)
    expect(voice.snapshot).toMatchObject({ input: 'muted', outputMuted: true })
    expect(voice.spoke).toBe(false)
    hold.update(voice.snapshot, true)
    hold.update(voice.snapshot, false)
    expect(voice.snapshot).toMatchObject({ input: 'listening', outputMuted: false })
  })

  it('leaves what was already muted muted, and keeps a toggle made during the dictation', () => {
    const voice = liveVoice('muted')
    const hold = new OrbDictationHold(voice)
    hold.update(voice.snapshot, true)
    hold.update(voice.snapshot, true)
    voice.muteInput(false)
    hold.update(voice.snapshot, true)
    hold.update(voice.snapshot, false)
    expect(voice.snapshot).toMatchObject({ input: 'listening', outputMuted: false })
  })

  it('forgets the hold when Live ends during the dictation', () => {
    const voice = liveVoice()
    const hold = new OrbDictationHold(voice)
    hold.update(voice.snapshot, true)
    hold.update({ ...voice.snapshot, connection: 'off' }, true)
    hold.update({ connection: 'live', input: 'listening', outputMuted: false }, false)
    expect(voice.snapshot).toMatchObject({ input: 'muted', outputMuted: true })
  })
})
