import { translate } from '@/i18n/i18n'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader,
  SettingsSwitchRow
} from '../settings/form-controls/SettingsFormControls'
import type { AgentHubSettingsSectionProps } from './agent-hub-settings-section-props'
import {
  AGENT_HUB_FINISHED_CLEAR_MINUTES,
  type AgentHubDefaultTab
} from '../../../../shared/agent-hub-settings'

function clearAfterLabel(minutes: number): string {
  return minutes === 0
    ? translate('auto.components.settings.ExperimentalPane.agentHub.clearNever', 'Never')
    : minutes === 60
      ? translate('auto.components.settings.ExperimentalPane.agentHub.clearHour', '1 h')
      : translate(
          'auto.components.settings.ExperimentalPane.agentHub.clearMinutes',
          '{{value0}} min',
          {
            value0: minutes
          }
        )
}

export function AgentHubSettingsPopoverSection({
  preferences,
  updateSettings
}: AgentHubSettingsSectionProps): React.JSX.Element {
  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader
        className="pt-2"
        title={translate('auto.components.settings.ExperimentalPane.agentHub.popover', 'Popover')}
      />
      <SettingsRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.defaultTab',
          'Open on'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.defaultTabCopy',
          'When nobody is waiting; a waiting agent always opens the Inbox.'
        )}
        control={
          <SettingsSegmentedControl<AgentHubDefaultTab>
            value={preferences.defaultTab}
            size="sm"
            onChange={(value) => updateSettings({ agentHubDefaultTab: value })}
            ariaLabel={translate(
              'auto.components.settings.ExperimentalPane.agentHub.defaultTab',
              'Open on'
            )}
            options={[
              { value: 'inbox', label: translate('agentHub.tab.inbox', 'Inbox') },
              { value: 'running', label: translate('agentHub.tab.running', 'Running') },
              { value: 'agents', label: translate('agentHub.tab.agents', 'Agents') },
              { value: 'all', label: translate('agentHub.tab.all', 'All terminals') }
            ]}
          />
        }
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.showShells',
          'List plain shells in All terminals'
        )}
        checked={preferences.showShells}
        onChange={() => updateSettings({ agentHubShowShells: !preferences.showShells })}
      />
      <SettingsRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.clearFinished',
          'Clear finished agents from the Inbox after'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.clearFinishedCopy',
          'They stay unread in the Agents view; Never keeps them in the hub until you read them.'
        )}
        control={
          <SettingsSegmentedControl<number>
            value={preferences.finishedClearMinutes}
            size="sm"
            onChange={(value) => updateSettings({ agentHubFinishedAutoClearMinutes: value })}
            ariaLabel={translate(
              'auto.components.settings.ExperimentalPane.agentHub.clearFinished',
              'Clear finished agents from the Inbox after'
            )}
            options={AGENT_HUB_FINISHED_CLEAR_MINUTES.map((minutes) => ({
              value: minutes,
              label: clearAfterLabel(minutes)
            }))}
          />
        }
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.focusedPaneOutline',
          'Outline the focused terminal'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.focusedPaneOutlineCopy',
          'A thin blue frame on the pane that has the keyboard, in the workspace and in mirrors: where typing and dictation go.'
        )}
        checked={preferences.focusedPaneOutline}
        onChange={() =>
          updateSettings({ agentHubFocusedPaneOutline: !preferences.focusedPaneOutline })
        }
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.paneQuickReply',
          'Quick reply in the terminal'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.paneQuickReplyCopy',
          "When a terminal agent asks or needs approval, a card with its options opens over the pane's corner. Esc closes it; the terminal still takes the answer."
        )}
        checked={preferences.paneQuickReply}
        onChange={() => updateSettings({ agentHubPaneQuickReply: !preferences.paneQuickReply })}
      />
    </section>
  )
}
