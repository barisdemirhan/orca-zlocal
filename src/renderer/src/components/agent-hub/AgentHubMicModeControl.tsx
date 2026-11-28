import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { normalizeAgentHubMicMode } from '../../../../shared/agent-hub-settings'
import { SettingsSwitchRow } from '../settings/form-controls/SettingsFormControls'
import { readAgentHubDictationCapabilities } from './agent-hub-dictation-capabilities'

export function AgentHubMicModeSetting(): React.JSX.Element {
  const improve = useAppStore(
    (s) => normalizeAgentHubMicMode(s.settings?.agentHubMicMode) === 'improve'
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  const canImprove = readAgentHubDictationCapabilities().improve
  return (
    <SettingsSwitchRow
      label={translate('agentHub.mic.improveWithAgent', 'Improve with an agent')}
      description={
        canImprove
          ? translate(
              'agentHub.mic.modeSwitchCopy',
              'When on, the mirror microphone dictates and improves; Shift-click does the opposite.'
            )
          : translate(
              'agentHub.mic.improveRequired',
              'Requires the Improve transcriptions feature.'
            )
      }
      checked={canImprove && improve}
      disabled={!canImprove}
      onChange={() => {
        if (readAgentHubDictationCapabilities().improve) {
          void updateSettings({ agentHubMicMode: improve ? 'dictate' : 'improve' })
        }
      }}
    />
  )
}
