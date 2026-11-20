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

function codexFailureMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null
  }
  switch (error.message) {
    case 'This Codex version does not support Live voice.':
      return translate(
        'auto.agentHub.orb.codexVoiceUnsupported',
        'This Codex version does not support Live voice.'
      )
    case 'Codex Live voice is unavailable because an account usage limit was reached.':
      return translate(
        'auto.agentHub.orb.codexVoiceUsageLimit',
        'Codex Live voice is unavailable because an account usage limit was reached.'
      )
    case 'Codex refused Live voice. Check the current account and workspace access.':
      return translate(
        'auto.agentHub.orb.codexVoiceAccessDenied',
        'Codex refused Live voice. Check the current account and workspace access.'
      )
    case 'Codex Live voice could not connect. Try again after the connection has closed.':
      return translate(
        'auto.agentHub.orb.codexVoiceConnectionFailed',
        'Codex Live voice could not connect. Try again after the connection has closed.'
      )
    default:
      return null
  }
}

export function agentHubOrbVoiceMediaFailure(
  reason: 'input-lost' | 'connection-lost' | 'playback-blocked'
): string {
  return reason === 'input-lost'
    ? 'The microphone disconnected.'
    : 'The live voice connection ended. Try again.'
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
        : (microphoneFailureMessage(error) ??
          codexFailureMessage(error) ??
          translate(
            'auto.agentHub.orb.voiceConnectFailed',
            'Live voice could not connect. Try again.'
          ))
  }
}
