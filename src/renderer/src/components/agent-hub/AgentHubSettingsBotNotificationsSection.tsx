import { translate } from '@/i18n/i18n'
import { useBotsEnabled } from '@/lib/bot-catalog'
import { SettingsSubsectionHeader } from '../settings/form-controls/SettingsFormControls'
import type { AgentHubSettingsSectionProps } from './agent-hub-settings-section-props'
import { SurfaceChoiceRow, SurfaceSwitchRow } from './AgentHubSettingsSurfaceRows'

export function AgentHubSettingsBotNotificationsSection({
  updateSettings
}: Pick<AgentHubSettingsSectionProps, 'updateSettings'>): React.JSX.Element | null {
  const botsEnabled = useBotsEnabled()
  if (!botsEnabled) {
    return null
  }
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader
        className="pt-2"
        title={translate('agentHub.settings.botNotifications', 'Bot notifications')}
        description={translate(
          'agentHub.settings.botNotificationsCopy',
          'What your bots raise next to the hub. Everything still reaches the Inbox.'
        )}
      />
      <SurfaceSwitchRow
        settingKey="agentHubBotAlertOnAsk"
        label={translate('agentHub.settings.botAsks', 'Asks')}
        updateSettings={updateSettings}
      />
      <SurfaceSwitchRow
        settingKey="agentHubBotAlertOnResult"
        label={translate('agentHub.settings.botResults', 'Results')}
        updateSettings={updateSettings}
      />
      <SurfaceSwitchRow
        settingKey="agentHubBotAlertOnFailure"
        label={translate('agentHub.settings.botFailures', 'Failures')}
        updateSettings={updateSettings}
      />
      <SurfaceSwitchRow
        settingKey="agentHubBotAlertOnSuggestion"
        label={translate('agentHub.settings.botSuggestions', 'Suggestions')}
        description={translate(
          'agentHub.settings.botSuggestionsCopy',
          'When off, suggestions only appear in the Inbox.'
        )}
        updateSettings={updateSettings}
      />
      <SurfaceChoiceRow
        settingKey="agentHubBotAutomationAlerts"
        label={translate('agentHub.settings.botAutomationResults', 'Automation results')}
        description={translate(
          'agentHub.settings.botAutomationResultsCopy',
          'Summary gives one alert for a batch of runs; Each run alerts for every run.'
        )}
        options={[
          { value: 'summary', label: translate('agentHub.settings.automationSummary', 'Summary') },
          {
            value: 'each-run',
            label: translate('agentHub.settings.automationEachRun', 'Each run')
          },
          { value: 'off', label: translate('agentHub.settings.automationOff', 'Off') }
        ]}
        updateSettings={updateSettings}
      />
      <SurfaceSwitchRow
        settingKey="agentHubBotAlertSound"
        label={translate('agentHub.settings.botSound', 'Play a sound')}
        updateSettings={updateSettings}
      />
      <SurfaceSwitchRow
        settingKey="agentHubBotNameInDesktopNotifications"
        label={translate(
          'agentHub.settings.botNameInNotifications',
          "Bot's name in desktop notifications"
        )}
        description={translate(
          'agentHub.settings.botNameInNotificationsCopy',
          'Turn off to keep bot names off your lock screen.'
        )}
        updateSettings={updateSettings}
      />
    </section>
  )
}
