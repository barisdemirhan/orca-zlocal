import { translate } from '@/i18n/i18n'
import { SettingsSubsectionHeader } from '../settings/form-controls/SettingsFormControls'
import { AgentHubMicModeSetting } from './AgentHubMicModeControl'

export function AgentHubSettingsVoiceSection(): React.JSX.Element {
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader title={translate('auto.agentHub.settings.voice', 'Voice')} />
      <AgentHubMicModeSetting />
    </section>
  )
}
