import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import type { AgentHubPreferences } from './use-agent-hub-settings'

export type AgentHubSettingsSectionProps = {
  preferences: AgentHubPreferences
  updateSettings: (updates: Partial<GlobalSettings>) => void
}
