import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import { DropdownMenuItem } from '../ui/dropdown-menu'
import { clearAgentHubAlerts } from './agent-hub-alert-queue'
import {
  AGENT_HUB_MUTE_CHOICES,
  agentHubMuteChoiceLabel,
  agentHubMuteUntil
} from './agent-hub-alert-mute'

export function AgentHubAlertMuteItems({
  updateSettings
}: {
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  return (
    <>
      {AGENT_HUB_MUTE_CHOICES.map((choice) => (
        <DropdownMenuItem
          key={choice}
          onSelect={() => {
            clearAgentHubAlerts()
            updateSettings({ agentHubAlertsMutedUntil: agentHubMuteUntil(choice, Date.now()) })
          }}
        >
          {agentHubMuteChoiceLabel(choice)}
        </DropdownMenuItem>
      ))}
    </>
  )
}
