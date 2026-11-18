import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import { translate } from '@/i18n/i18n'
import { SettingsRow, SettingsSwitchRow } from '../settings/form-controls/SettingsFormControls'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import { AgentHubSettingsDockSection } from './AgentHubSettingsDockSection'
import { AgentHubAlertSettings } from './AgentHubAlertSettings'
import { AgentHubSettingsPopoverSection } from './AgentHubSettingsPopoverSection'
import { AgentHubSettingsMirrorsSection } from './AgentHubSettingsMirrorsSection'
import { AgentHubSettingsVoiceSection } from './AgentHubSettingsVoiceSection'
import { AgentHubSettingsOrbSection } from './AgentHubSettingsOrbSection'
import { Button } from '../ui/button'
import { openAgentHubShortcuts } from './agent-hub-shortcuts-dialog'

export function AgentHubSettingsPane({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const preferences = useAgentHubPreferences()
  const sectionProps = { preferences, updateSettings }
  return (
    <div className="space-y-6">
      <SettingsSwitchRow
        label={translate('agentHub.settings.agentControl', 'Let agents control Agent Hub')}
        description={translate(
          'agentHub.settings.agentControlCopy',
          'Agents can show you things, ask questions and manage their mirrors.'
        )}
        checked={preferences.agentControl}
        onChange={() => updateSettings({ agentHubAgentControl: !preferences.agentControl })}
      />
      <AgentHubSettingsDockSection {...sectionProps} />
      <SettingsRow
        label={translate('agentHub.shortcuts.title', 'Keyboard shortcuts')}
        control={
          <Button type="button" variant="outline" size="xs" onClick={openAgentHubShortcuts}>
            {translate('agentHub.shortcuts.edit', 'Edit shortcuts')}
          </Button>
        }
      />
      <section className="space-y-3">
        <AgentHubAlertSettings {...sectionProps} />
      </section>
      <AgentHubSettingsPopoverSection {...sectionProps} />
      <AgentHubSettingsMirrorsSection {...sectionProps} />
      <AgentHubSettingsVoiceSection />
      <AgentHubSettingsOrbSection settings={settings} updateSettings={updateSettings} />
    </div>
  )
}
