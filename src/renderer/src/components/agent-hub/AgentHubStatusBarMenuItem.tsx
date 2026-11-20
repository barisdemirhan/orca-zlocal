import { Inbox } from 'lucide-react'
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useAgentHubPreferences } from './use-agent-hub-settings'

/** The status bar's show/hide entry for the hub; unchecked, the hub lives on its dock. */
export function AgentHubStatusBarMenuItem(): React.JSX.Element {
  const { placement } = useAgentHubPreferences()
  const updateSettings = useAppStore((s) => s.updateSettings)
  return (
    <DropdownMenuCheckboxItem
      checked={placement === 'status-bar'}
      onCheckedChange={(checked) =>
        updateSettings({ agentHubPlacement: checked ? 'status-bar' : 'dock' })
      }
    >
      <Inbox className="size-3.5" />
      {translate('agentHub.statusBarMenuItem', 'Agent Hub')}
    </DropdownMenuCheckboxItem>
  )
}
