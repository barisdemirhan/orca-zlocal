import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { translate } from '@/i18n/i18n'
import { Label } from '../ui/label'
import { SearchableSetting } from '../settings/SearchableSetting'
import { SettingsSwitch } from '../settings/SettingsFormControls'
import { getExperimentalSearchEntry } from '../settings/experimental-search'

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
        'Status bar popover with every agent and terminal: answer questions, approve commands, and jump to any pane.'
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
              'Adds an Agents item to the status bar. It lists agents that need you, are working, or just finished, plus every open terminal, and lets you answer or open a live mirror without leaving your current workspace.'
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
    </SearchableSetting>
  )
}
