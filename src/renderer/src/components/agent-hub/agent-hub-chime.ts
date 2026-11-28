import { playDesktopNotificationSound } from '@/lib/notifications/desktop-notification-sound'

// Two quick rising notes; short enough to read as a ping, not a melody.
const CHIME_NOTES_HZ = [880, 1318.5] as const
const NOTE_GAP_S = 0.11
const NOTE_LENGTH_S = 0.32
const PEAK_GAIN = 0.18

let audioContext: AudioContext | null = null

function playBuiltInChime(volume: number): void {
  if (typeof AudioContext === 'undefined') {
    return
  }
  try {
    audioContext ??= new AudioContext()
    const context = audioContext
    const start = context.currentTime
    CHIME_NOTES_HZ.forEach((frequency, index) => {
      const at = start + index * NOTE_GAP_S
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN * volume + 0.0001, at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_LENGTH_S)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + NOTE_LENGTH_S + 0.02)
    })
  } catch {
    // Audio can be unavailable (no output device); the bubble still shows.
  }
}

/**
 * The sound picked in Settings › Notifications, at its volume. Why a built-in chime for
 * "system": that choice only sounds through an OS banner, which the hub alerts exactly when
 * Orca suppresses one.
 */
export function playAgentHubAlertSound(sound: {
  customSoundId: string
  customSoundVolume: number | null
}): void {
  if (sound.customSoundId !== 'system') {
    void playDesktopNotificationSound(sound.customSoundId, sound.customSoundVolume)
    return
  }
  playBuiltInChime(Math.min(1, Math.max(0, (sound.customSoundVolume ?? 100) / 100)))
}
