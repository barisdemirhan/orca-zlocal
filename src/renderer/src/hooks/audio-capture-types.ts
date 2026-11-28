export type StartAudioCaptureOptions = {
  bufferAudio?: boolean
  sessionId?: string
  /** null/undefined = system default input device */
  microphoneDeviceId?: string | null
  /** Cached label for a device whose id was re-salted. */
  microphoneDeviceLabel?: string | null
  onCaptureLost?: () => void
  /** Fires when the host's session accepts no more audio (cloud upload cap) */
  onAudioLimitReached?: () => void
}

export type StartAudioCaptureResult = { fellBackToDefaultMicrophone: boolean }
export type StopAudioCaptureOptions = { preserveBufferedAudio?: boolean }
