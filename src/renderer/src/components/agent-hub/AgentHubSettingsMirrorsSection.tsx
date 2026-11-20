import { translate } from '@/i18n/i18n'
import {
  NumberField,
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader,
  SettingsSwitchRow
} from '../settings/form-controls/SettingsFormControls'
import type { AgentHubSettingsSectionProps } from './agent-hub-settings-section-props'
import {
  AGENT_HUB_MIRROR_WINDOW_CAP_MAX,
  AGENT_HUB_MIRROR_WINDOW_CAP_MIN,
  AGENT_HUB_TRAY_PEEK_SECONDS,
  DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP
} from '../../../../shared/agent-hub-settings'
import { AgentHubSettingsDimMode } from './AgentHubSettingsDimMode'

export function AgentHubSettingsMirrorsSection({
  preferences,
  updateSettings
}: AgentHubSettingsSectionProps): React.JSX.Element {
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader
        title={translate('auto.agentHub.settings.mirrors', 'Mirrors & canvas')}
      />
      <NumberField
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.mirrorCap',
          'Mirror windows open at once'
        )}
        description={`${translate(
          'auto.components.settings.ExperimentalPane.agentHub.mirrorCapCopy',
          'Opening more than this parks the oldest one beside the hub.'
        )} ${AGENT_HUB_MIRROR_WINDOW_CAP_MIN}–${AGENT_HUB_MIRROR_WINDOW_CAP_MAX}`}
        value={preferences.mirrorWindowCap}
        defaultValue={DEFAULT_AGENT_HUB_MIRROR_WINDOW_CAP}
        min={AGENT_HUB_MIRROR_WINDOW_CAP_MIN}
        max={AGENT_HUB_MIRROR_WINDOW_CAP_MAX}
        integer
        onChange={(value) => updateSettings({ agentHubMirrorWindowCap: value })}
      />
      <SettingsRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.trayPeek',
          'Fan out parked mirrors on news for'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.trayPeekCopy',
          'When a parked mirror asks or finishes, the pile beside the hub opens this long, then folds again.'
        )}
        control={
          <SettingsSegmentedControl<number>
            value={preferences.trayPeekSeconds}
            size="sm"
            onChange={(value) => updateSettings({ agentHubTrayPeekSeconds: value })}
            ariaLabel={translate(
              'auto.components.settings.ExperimentalPane.agentHub.trayPeek',
              'Fan out parked mirrors on news for'
            )}
            options={AGENT_HUB_TRAY_PEEK_SECONDS.map((seconds) => ({
              value: seconds,
              label:
                seconds === 0
                  ? translate('auto.components.settings.ExperimentalPane.agentHub.never', 'Never')
                  : translate(
                      'auto.components.settings.ExperimentalPane.agentHub.seconds',
                      '{{value0}} s',
                      { value0: seconds }
                    )
            }))}
          />
        }
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.tabAutoPopout',
          'Show a pop-out button on terminal tabs'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.tabAutoPopoutCopy',
          'Open a terminal in a mirror directly from its tab.'
        )}
        checked={preferences.tabAutoPopout}
        onChange={() => updateSettings({ agentHubTabAutoPopout: !preferences.tabAutoPopout })}
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.canvas',
          'Enable the mirrors canvas'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.canvasCopy',
          'Open the canvas with its button or shortcut to lay out your mirrors. Pop out keeps your current view. Leaving the canvas parks its mirrors; coming back restores them.'
        )}
        checked={preferences.canvas}
        onChange={() => updateSettings({ agentHubCanvas: !preferences.canvas })}
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.restoreOnLaunch',
          'Restore mirrors and the canvas on launch'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.restoreOnLaunchCopy',
          'Mirrors, the tray and the canvas come back as you left them when Orca restarts. A mirror whose terminal was closed is left out.'
        )}
        checked={preferences.restoreOnLaunch}
        onChange={() => updateSettings({ agentHubRestoreOnLaunch: !preferences.restoreOnLaunch })}
      />
      <AgentHubSettingsDimMode updateSettings={updateSettings} />
    </section>
  )
}
