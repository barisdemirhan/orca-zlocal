import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import {
  closeAgentHubMirrorDrawer,
  openAgentHubMirrorDrawer,
  useAgentHubMirrorDrawer
} from './agent-hub-mirror-drawer-store'
import { agentHubMirrorSourceKey } from './agent-hub-mirror-membership'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/** A bot chat has no work strip to open its settings from, so the header carries the switch. */
export function AgentHubMirrorBotSettingsButton({
  target
}: {
  target: AgentHubPaneTarget
}): React.JSX.Element {
  const sourceKey = agentHubMirrorSourceKey(target)
  const open = useAgentHubMirrorDrawer(sourceKey) === 'settings'
  const label = translate('agentHub.mirror.bot.settings', 'Bot settings')
  return (
    <AgentHubActionTooltip label={label}>
      <Button
        type="button"
        variant="ghost-muted"
        size="icon-xs"
        aria-label={label}
        aria-pressed={open}
        onClick={() =>
          open
            ? closeAgentHubMirrorDrawer(sourceKey, 'user')
            : openAgentHubMirrorDrawer(sourceKey, 'settings', 'user')
        }
      >
        <Settings2 className="size-3.5" />
      </Button>
    </AgentHubActionTooltip>
  )
}
