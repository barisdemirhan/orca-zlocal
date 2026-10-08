import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'

export function AgentHubMirrorJumpButton({
  onReveal,
  showShortcut = true
}: {
  onReveal: () => void
  showShortcut?: boolean
}): React.JSX.Element {
  return (
    <AgentHubActionTooltip
      label={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
      actionId={showShortcut ? 'agentHub.jumpToMirror' : undefined}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={translate('agentHub.mirror.jump', 'Jump')}
        data-agent-hub-no-tab-drop
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onReveal()
        }}
      >
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Button>
    </AgentHubActionTooltip>
  )
}
