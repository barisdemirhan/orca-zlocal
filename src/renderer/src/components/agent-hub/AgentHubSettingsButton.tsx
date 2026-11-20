import { Settings } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { AgentHubActionTooltip } from './AgentHubShortcut'

export function useOpenAgentHubSettings(): () => void {
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  return () => {
    openSettingsTarget({ pane: 'agentHub', repoId: null })
    openSettingsPage()
  }
}

export function AgentHubSettingsButton({ onOpened }: { onOpened: () => void }): React.JSX.Element {
  const openAgentHubSettings = useOpenAgentHubSettings()
  const label = translate('auto.agentHub.settings.open', 'Open Agent Hub settings')
  return (
    <AgentHubActionTooltip label={label}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        onClick={() => {
          openAgentHubSettings()
          onOpened()
        }}
      >
        <Settings />
      </Button>
    </AgentHubActionTooltip>
  )
}
