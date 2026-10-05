import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  AGENT_HUB_FINISHED_CLEAR_MINUTES,
  AGENT_HUB_MIRROR_WINDOW_CAPS,
  AGENT_HUB_TRAY_PEEK_SECONDS,
  type AgentHubDefaultTab,
  type AgentHubDockSize,
  type AgentHubPlacement
} from '../../../../shared/agent-hub-settings'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { SearchableSetting } from '../settings/SearchableSetting'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader,
  SettingsSwitch,
  SettingsSwitchRow
} from '../settings/SettingsFormControls'
import { getExperimentalSearchEntry } from '../settings/experimental-search'
import { AGENT_HUB_DOCK_SIZES, agentHubDockSizeLabel } from './AgentHubDockMenu'
import { AgentHubShortcutSetting } from './AgentHubShortcutSetting'
import { useAgentHubPreferences } from './use-agent-hub-settings'

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

function AgentHubOptions({
  updateSettings
}: {
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const preferences = useAgentHubPreferences()
  const now = useNow(30_000)
  const mutedUntil = preferences.alertsMutedUntil
  const muted = mutedUntil !== null && mutedUntil > now
  return (
    <div className="ml-4 space-y-3 border-l border-border pl-4">
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
      <AgentHubShortcutSetting />
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

      <SettingsSubsectionHeader
        className="pt-2"
        title={translate('auto.components.settings.ExperimentalPane.agentHub.alerts', 'Alerts')}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.alertsCopy',
          "A bubble next to the hub that opens the agent's card. Skipped for the pane you are looking at."
        )}
      />
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
      <SettingsRow
        label={translate(
          'auto.components.settings.ExperimentalPane.agentHub.mirrorCap',
          'Mirror windows open at once'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.mirrorCapCopy',
          'Opening more than this parks the oldest one beside the hub.'
        )}
        control={
          <SettingsSegmentedControl<number>
            value={preferences.mirrorWindowCap}
            size="sm"
            onChange={(value) => updateSettings({ agentHubMirrorWindowCap: value })}
            ariaLabel={translate(
              'auto.components.settings.ExperimentalPane.agentHub.mirrorCap',
              'Mirror windows open at once'
            )}
            options={AGENT_HUB_MIRROR_WINDOW_CAPS.map((cap) => ({
              value: cap,
              label: String(cap)
            }))}
          />
        }
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
          'Show the auto pop-out toggle on terminal tabs'
        )}
        description={translate(
          'auto.components.settings.ExperimentalPane.agentHub.tabAutoPopoutCopy',
          'A tab with its toggle on parks its terminal beside the hub when you leave the tab, and takes it back when you return.'
        )}
        checked={preferences.tabAutoPopout}
        onChange={() => updateSettings({ agentHubTabAutoPopout: !preferences.tabAutoPopout })}
      />
    </div>
  )
}

export function AgentHubExperimentalSetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const enabled = settings.experimentalAgentHub === true

  return (
    <SearchableSetting
      title={translate('auto.components.settings.ExperimentalPane.agentHub.title', 'Agent Hub')}
      description={translate(
        'auto.components.settings.ExperimentalPane.agentHub.description',
        'One place for every agent and terminal: answer questions, approve commands, and jump to any pane.'
      )}
      keywords={getExperimentalSearchEntry().agentHub.keywords}
      className="space-y-3 py-2"
      id="experimental-agent-hub"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 shrink space-y-0.5">
          <Label>
            {translate('auto.components.settings.ExperimentalPane.agentHub.title', 'Agent Hub')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.ExperimentalPane.agentHub.copy',
              'Adds a dock (or a status-bar item) listing agents that need you, are working, or just finished, plus every open terminal. Answer, approve, or open a live mirror without leaving your current workspace.'
            )}
          </p>
        </div>
        <SettingsSwitch
          checked={enabled}
          ariaLabel={translate(
            'auto.components.settings.ExperimentalPane.agentHub.toggleLabel',
            'Toggle Agent Hub'
          )}
          onChange={() => updateSettings({ experimentalAgentHub: !enabled })}
        />
      </div>
      {enabled ? <AgentHubOptions updateSettings={updateSettings} /> : null}
    </SearchableSetting>
  )
}
