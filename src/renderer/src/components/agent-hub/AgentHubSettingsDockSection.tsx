import { translate } from '@/i18n/i18n'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader,
  SettingsSwitchRow
} from '../settings/form-controls/SettingsFormControls'
import type { AgentHubSettingsSectionProps } from './agent-hub-settings-section-props'
import type { AgentHubDockSize, AgentHubPlacement } from '../../../../shared/agent-hub-settings'
import { AGENT_HUB_DOCK_SIZES, agentHubDockSizeLabel } from './AgentHubDockMenu'

export function AgentHubSettingsDockSection({
  preferences,
  updateSettings
}: AgentHubSettingsSectionProps): React.JSX.Element {
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader title={translate('auto.agentHub.settings.dock', 'Dock')} />
      <SettingsRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.placement',
          'Show the hub as'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.placementCopy',
          'A dock you can drag onto the status bar or a window edge, or an item in the status bar.'
        )}
        control={
          <SettingsSegmentedControl<AgentHubPlacement>
            value={preferences.placement}
            onChange={(value) => updateSettings({ agentHubPlacement: value })}
            ariaLabel={translate(
              'auto.components.settings.ExperimentalPane.agentHub.placement',
              'Show the hub as'
            )}
            options={[
              {
                value: 'dock',
                label: translate('auto.components.settings.ExperimentalPane.agentHub.dock', 'Dock')
              },
              {
                value: 'status-bar',
                label: translate(
                  'auto.components.settings.ExperimentalPane.agentHub.statusBar',
                  'Status bar'
                )
              }
            ]}
          />
        }
      />
      {preferences.placement === 'dock' ? (
        <SettingsRow
          label={translate(
            'auto.components.settings.ExperimentalPane.agentHub.dockSize',
            'Dock size'
          )}
          control={
            <SettingsSegmentedControl<AgentHubDockSize>
              value={preferences.dockSize}
              size="sm"
              onChange={(value) => updateSettings({ agentHubDockSize: value })}
              ariaLabel={translate(
                'auto.components.settings.ExperimentalPane.agentHub.dockSize',
                'Dock size'
              )}
              options={AGENT_HUB_DOCK_SIZES.map((value) => ({
                value,
                label: agentHubDockSizeLabel(value)
              }))}
            />
          }
        />
      ) : null}
      {preferences.placement === 'dock' ? (
        <SettingsSwitchRow
          label={translate(
            'auto.components.settings.ExperimentalPane.agentHub.autoHide',
            'Hide the dock while no agent is active'
          )}
          description={translate(
            'auto.components.settings.ExperimentalPane.agentHub.autoHideCopy',
            'It comes back as soon as an agent starts working, asks something, or finishes.'
          )}
          checked={preferences.dockAutoHide}
          onChange={() => updateSettings({ agentHubDockAutoHide: !preferences.dockAutoHide })}
        />
      ) : null}
    </section>
  )
}
