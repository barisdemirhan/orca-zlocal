import type { AgentHubOrbVoiceSnapshot } from './agent-hub-orb-voice-state'

type OrbLiveVoice = {
  muteInput: (muted: boolean) => void
  muteOutput: (muted: boolean) => void
  stopSpeaking: () => void
}
type Mutes = { input: boolean; output: boolean }

/** Why: a dictation elsewhere in Orca shares the microphone, so Live neither hears nor talks over it. */
export class OrbDictationHold {
  /** The mute choices to restore; a toggle the user makes during the dictation replaces its entry. */
  private restore: Mutes | null = null
  private seen: Mutes = { input: true, output: true }

  constructor(private readonly voice: OrbLiveVoice) {}

  update(
    snapshot: Pick<AgentHubOrbVoiceSnapshot, 'connection' | 'input' | 'outputMuted'>,
    dictating: boolean
  ): void {
    if (snapshot.connection !== 'live') {
      this.restore = null
      return
    }
    const now = { input: snapshot.input === 'muted', output: snapshot.outputMuted }
    if (!this.restore) {
      if (dictating) {
        this.restore = now
        this.seen = { input: true, output: true }
        this.voice.muteInput(true)
        this.voice.muteOutput(true)
        this.voice.stopSpeaking()
      }
      return
    }
    if (now.input !== this.seen.input) {
      this.restore.input = now.input
    }
    if (now.output !== this.seen.output) {
      this.restore.output = now.output
    }
    this.seen = now
    if (!dictating) {
      const { input, output } = this.restore
      this.restore = null
      this.voice.muteInput(input)
      this.voice.muteOutput(output)
    }
  }
}
