import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '../ui/button'
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
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
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
      {enabled ? (
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={() => openSettingsTarget({ pane: 'agentHub', repoId: null })}
        >
          {translate('auto.agentHub.settings.open', 'Open Agent Hub settings')}
        </Button>
      ) : null}
    </SearchableSetting>
  )
}
