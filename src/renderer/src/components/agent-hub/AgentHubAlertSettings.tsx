import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { AgentHubAlertMuteItems } from './AgentHubAlertMuteItems'
import {
  SettingsRow,
  SettingsSubsectionHeader,
  SettingsSwitchRow
} from '../settings/form-controls/SettingsFormControls'
import type { AgentHubPreferences } from './use-agent-hub-settings'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

/** The Alerts part of the Agent Hub settings: what raises a bubble, the sound, and the mute. */
export function AgentHubAlertSettings({
  preferences,
  updateSettings
}: {
  preferences: AgentHubPreferences
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const now = useNow(30_000)
  const mutedUntil = preferences.alertsMutedUntil
  const muted = mutedUntil !== null && mutedUntil > now
  return (
    <>
      <SettingsSubsectionHeader
        className="pt-2"
        title={translate('auto.components.settings.ExperimentalPane.agentHub.alerts', 'Alerts')}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.alertsCopy',
          "A bubble next to the hub that opens the agent's card. Skipped for the pane you are looking at."
        )}
      />
      <SettingsSwitchRow
        label={translate('agentHub.answerQueue.title', 'Answer queue')}
        checked={preferences.answerQueue}
        onChange={() => updateSettings({ agentHubAnswerQueue: !preferences.answerQueue })}
      />
      {preferences.answerQueue ? (
        <>
          <SettingsRow
            label={translate('agentHub.answerQueue.openWhen', 'Open when a question arrives')}
            control={
              <Select
                value={preferences.answerQueueOpening}
                onValueChange={(value) =>
                  updateSettings({
                    agentHubAnswerQueueOpening: value === 'shortcut' ? 'shortcut' : 'automatically'
                  })
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatically">
                    {translate('agentHub.answerQueue.automatically', 'Automatically')}
                  </SelectItem>
                  <SelectItem value="shortcut">
                    {translate('agentHub.answerQueue.onlyShortcut', 'Only on shortcut')}
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingsSwitchRow
            label={translate('agentHub.answerQueue.includeApprovals', 'Include approvals')}
            checked={preferences.answerQueueIncludeApprovals}
            onChange={() =>
              updateSettings({
                agentHubAnswerQueueIncludeApprovals: !preferences.answerQueueIncludeApprovals
              })
            }
          />
        </>
      ) : null}
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.alertNeedsInput',
          'When an agent asks or needs approval'
        )}
        checked={preferences.alertOnNeedsInput}
        onChange={() =>
          updateSettings({ agentHubAlertOnNeedsInput: !preferences.alertOnNeedsInput })
        }
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.alertFinished',
          'When an agent finishes'
        )}
        checked={preferences.alertOnFinished}
        onChange={() => updateSettings({ agentHubAlertOnFinished: !preferences.alertOnFinished })}
      />
      <SettingsSwitchRow
        label={translate('auto.agentHub.alerts.info', 'When an agent shares information')}
        checked={preferences.alertOnInfo}
        onChange={() => updateSettings({ agentHubAlertOnInfo: !preferences.alertOnInfo })}
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.sound',
          'Play a sound'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.soundCopy',
          "Uses the sound and volume from Notifications (a short chime for System), and stays quiet when Orca's own notification already plays one."
        )}
        checked={preferences.alertSound}
        onChange={() => updateSettings({ agentHubAlertSound: !preferences.alertSound })}
      />
      {muted && mutedUntil !== null ? (
        <SettingsRow
          label={translate(
            'auto.components.settings.ExperimentalPane.agentHub.mutedUntil',
            'Alerts are muted until {{value0}}',
            {
              value0: new Date(mutedUntil).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          )}
          control={
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => updateSettings({ agentHubAlertsMutedUntil: null })}
            >
              {translate(
                'auto.components.settings.ExperimentalPane.agentHub.unmute',
                'Turn back on'
              )}
            </Button>
          }
        />
      ) : null}
      <SettingsRow
        label={translate('auto.agentHub.alerts.mute', 'Mute alerts')}
        control={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="xs">
                {translate('auto.agentHub.alerts.duration', 'Choose duration…')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <AgentHubAlertMuteItems updateSettings={updateSettings} />
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </>
  )
}
