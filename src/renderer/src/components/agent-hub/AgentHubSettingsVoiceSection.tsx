import { translate } from '@/i18n/i18n'
import { SettingsSubsectionHeader } from '../settings/form-controls/SettingsFormControls'
import type { AgentHubSettingsSectionProps } from './agent-hub-settings-section-props'
import { SurfaceSwitchRow } from './AgentHubSettingsSurfaceRows'
import { AgentHubMicModeSetting } from './AgentHubMicModeControl'

export function AgentHubSettingsVoiceSection({
  updateSettings
}: Pick<AgentHubSettingsSectionProps, 'updateSettings'>): React.JSX.Element {
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader title={translate('auto.agentHub.settings.voice', 'Voice')} />
      <AgentHubMicModeSetting />
      <SurfaceSwitchRow
        settingKey="agentHubOrbKeepLiveOnSwitch"
        label={translate('agentHub.settings.keepLiveOnSwitch', 'Keep Live on chat switch')}
        description={translate(
          'agentHub.settings.keepLiveOnSwitchCopy',
          'A live conversation stays with its chat when you show another chat.'
        )}
        updateSettings={updateSettings}
      />
    </section>
  )
}
