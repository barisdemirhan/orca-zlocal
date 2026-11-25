import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import type { AgentHubSurfaceSettings } from '../../../../shared/agent-hub-surface-settings'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSwitchRow
} from '../settings/form-controls/SettingsFormControls'
import { useAgentHubSurfaceSetting } from './use-agent-hub-surface-setting'

type SurfaceValues = Required<AgentHubSurfaceSettings>
export type SurfaceSwitchKey = {
  [K in keyof SurfaceValues]: SurfaceValues[K] extends boolean ? K : never
}[keyof SurfaceValues]
export type SurfaceChoiceKey = Exclude<keyof SurfaceValues, SurfaceSwitchKey>
type UpdateSettings = (updates: Partial<GlobalSettings>) => void

export function SurfaceSwitchRow({
  settingKey,
  label,
  description,
  updateSettings
}: {
  settingKey: SurfaceSwitchKey
  label: string
  description?: string
  updateSettings: UpdateSettings
}): React.JSX.Element {
  const checked = useAgentHubSurfaceSetting(settingKey)
  return (
    <SettingsSwitchRow
      label={label}
      description={description}
      checked={checked}
      onChange={() => updateSettings({ [settingKey]: !checked })}
    />
  )
}

export function SurfaceChoiceRow<K extends SurfaceChoiceKey>({
  settingKey,
  label,
  description,
  options,
  updateSettings
}: {
  settingKey: K
  label: string
  description?: string
  options: { value: SurfaceValues[K]; label: string }[]
  updateSettings: UpdateSettings
}): React.JSX.Element {
  const value = useAgentHubSurfaceSetting(settingKey)
  return (
    <SettingsRow
      label={label}
      description={description}
      control={
        <SettingsSegmentedControl<SurfaceValues[K]>
          value={value}
          size="sm"
          ariaLabel={label}
          onChange={(next) => updateSettings({ [settingKey]: next })}
          options={options}
        />
      }
    />
  )
}
