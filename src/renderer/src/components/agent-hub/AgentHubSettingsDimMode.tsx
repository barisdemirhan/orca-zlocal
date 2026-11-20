import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { agentHubFloatingDimMode } from '../../../../shared/agent-hub-settings'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SettingsRow } from '../settings/form-controls/SettingsFormControls'
import { AGENT_HUB_DIM_MODES, agentHubDimModeLabel } from './agent-hub-dim-mode-options'

export function AgentHubSettingsDimMode({
  updateSettings
}: {
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const mode = useAppStore((state) => agentHubFloatingDimMode(state.settings))
  const label = translate('agentHub.dim.title', 'Dim behind floating windows')
  return (
    <SettingsRow
      label={label}
      control={
        <Select
          value={mode}
          onValueChange={(value) => {
            const next = AGENT_HUB_DIM_MODES.find((candidate) => candidate === value)
            if (next) {
              updateSettings({ agentHubFloatingDimMode: next })
            }
          }}
        >
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_HUB_DIM_MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {agentHubDimModeLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  )
}
