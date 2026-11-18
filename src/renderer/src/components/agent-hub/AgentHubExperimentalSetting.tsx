import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { SearchableSetting } from '../settings/section-layout/SearchableSetting'
import { Switch } from '../ui/switch'
import { getExperimentalSearchEntry } from '../settings/advanced/experimental-search'

export function AgentHubExperimentalSetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const t = useTranslate()
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const enabled = settings.experimentalAgentHub === true

  return (
    <SearchableSetting
      title={t('auto.components.settings.ExperimentalPane.agentHub.title', 'Agent Hub')}
      description={t(
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
            {t('auto.components.settings.ExperimentalPane.agentHub.title', 'Agent Hub')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              'auto.components.settings.ExperimentalPane.agentHub.copy',
              'Adds a dock (or a status-bar item) listing agents that need you, are working, or just finished, plus every open terminal. Answer, approve, or open a live mirror without leaving your current workspace.'
            )}
          </p>
        </div>
        <Switch
          checked={enabled}
          aria-label={t(
            'auto.components.settings.ExperimentalPane.agentHub.toggleLabel',
            'Toggle Agent Hub'
          )}
          onCheckedChange={() => updateSettings({ experimentalAgentHub: !enabled })}
        />
      </div>
      {enabled ? (
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={() => openSettingsTarget({ pane: 'agentHub', repoId: null })}
        >
          {t('auto.agentHub.settings.open', 'Open Agent Hub settings')}
        </Button>
      ) : null}
    </SearchableSetting>
  )
}
