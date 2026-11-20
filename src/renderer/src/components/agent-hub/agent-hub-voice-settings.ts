import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getDefaultVoiceSettings } from '../../../../shared/orca-profiles/constants'
import type { VoiceSettings } from '../../../../shared/speech/speech-types'
import { handleVoiceDictationToggle } from '../settings/voice/voice-dictation-toggle'

export function updateAgentHubVoiceSettings(updates: Partial<VoiceSettings>): void {
  const { settings, updateSettings } = useAppStore.getState()
  // Why read at call time: the write replaces the whole voice object, so a stale copy would
  // undo a change made since (see VoicePane).
  void updateSettings({
    voice: { ...(settings?.voice ?? getDefaultVoiceSettings()), ...updates }
  })
}

/** The Settings switch, from a menu: asks for the microphone first, with the same notices. */
export async function toggleAgentHubVoiceDictation(
  setPermissionPending: (pending: boolean) => void
): Promise<void> {
  const state = useAppStore.getState()
  await handleVoiceDictationToggle({
    voiceEnabled: state.settings?.voice?.enabled === true,
    markFeatureTipsSeen: state.markFeatureTipsSeen,
    updateVoiceSettings: updateAgentHubVoiceSettings,
    requestMicrophonePermission: () =>
      window.api.developerPermissions.request({ id: 'microphone' }),
    setPermissionPending,
    notifyPermissionGranted: () =>
      toast.success(
        translate('auto.components.settings.VoicePane.cd9fe37556', 'Microphone permission granted')
      ),
    notifyPermissionOpenedSystemSettings: () =>
      toast.message(
        translate(
          'auto.components.settings.VoicePane.1eac933202',
          'Opened macOS Privacy & Security. Enable dictation again after granting access.'
        )
      ),
    notifyPermissionRequired: () =>
      toast.message(
        translate(
          'auto.components.settings.VoicePane.f9a9cf6928',
          'Microphone permission is required before enabling voice dictation.'
        )
      ),
    notifyPermissionRequestFailed: () =>
      toast.error(
        translate(
          'auto.components.settings.VoicePane.ad5d036ecc',
          'Could not request microphone permission. Voice dictation was not enabled.'
        )
      )
  })
}

export function openAgentHubVoiceSettings(): void {
  const state = useAppStore.getState()
  state.openSettingsTarget({ pane: 'voice', repoId: null })
  state.openSettingsPage()
}
