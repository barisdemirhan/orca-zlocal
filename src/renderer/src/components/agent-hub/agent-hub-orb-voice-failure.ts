import { AgentSessionVoiceRefusal } from '@/runtime/agent-session-voice-client'
import { translate } from '@/i18n/i18n'
import { isMicrophoneDeviceConstraintError } from '../dictation/microphone-devices'
import {
  MicrophoneCaptureBusyError,
  MicrophoneCaptureUnavailableError
} from '../dictation/microphone-capture-lease'

function microphoneFailureMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return null
  }
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return translate(
      'auto.components.settings.VoiceMicrophoneSetting.permissionDenied',
      'Microphone access is blocked. Grant it in your system settings, then try again.'
    )
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return translate(
      'auto.components.settings.VoiceMicrophoneSetting.noMicrophoneFound',
      'No microphone was found. Connect one, then try again.'
    )
  }
  if (
    isMicrophoneDeviceConstraintError(error) ||
    error.name === 'NotReadableError' ||
    error.name === 'TrackStartError'
  ) {
    return translate(
      'auto.components.settings.VoiceMicrophoneSetting.openFailed',
      'Could not open the microphone.'
    )
  }
  return null
}

export function agentHubOrbVoiceStartFailure(error: unknown): {
  reason: string
  mediaUnsupported: boolean
} {
  return {
    mediaUnsupported: error instanceof MicrophoneCaptureUnavailableError,
    reason:
      error instanceof AgentSessionVoiceRefusal ||
      error instanceof MicrophoneCaptureBusyError ||
      error instanceof MicrophoneCaptureUnavailableError
        ? error.message
        : (microphoneFailureMessage(error) ?? 'Live voice could not connect. Try again.')
  }
}
