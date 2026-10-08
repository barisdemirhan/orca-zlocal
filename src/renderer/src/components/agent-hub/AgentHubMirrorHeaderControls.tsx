import { Button } from '@/components/ui/button'
import { Minus, PictureInPicture2, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { AgentHubDimToggle } from './AgentHubDimToggle'
import { AgentHubMirrorFocusButton } from './AgentHubMirrorFocusButton'
import { AgentHubMirrorMicButton } from './AgentHubMirrorMicButton'
import { AgentHubMirrorJumpButton } from './AgentHubMirrorJumpButton'
import { requestAgentHubMirrorsDock } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function AgentHubMirrorHeaderControls({
  target,
  reachable,
  mirrorKey,
  focused,
  showJump = true,
  onReveal,
  onMinimize,
  onClose
}: {
  target: AgentHubPaneTarget
  reachable: boolean
  mirrorKey: string
  focused: boolean
  showJump?: boolean
  onReveal: () => void
  onMinimize: () => void
  onClose: () => void
}): React.JSX.Element {
  const dockLabel = translate('agentHub.mirror.dockAll', 'Send all mirrors to the hub')
  const minimizeLabel = translate('agentHub.mirror.minimize', 'Minimize')
  const closeLabel = translate('agentHub.mirror.close', 'Close mirror')
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <AgentHubDimToggle appearance="mirror" />
      <AgentHubMirrorMicButton target={target} reachable={reachable} />
      {showJump ? <AgentHubMirrorJumpButton onReveal={onReveal} /> : null}
      <AgentHubActionTooltip label={dockLabel} actionId="agentHub.dockMirrors">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={dockLabel}
          onClick={() => requestAgentHubMirrorsDock()}
        >
          <PictureInPicture2 className="size-3.5" />
        </Button>
      </AgentHubActionTooltip>
      <AgentHubMirrorFocusButton mirrorKey={mirrorKey} focused={focused} />
      <AgentHubActionTooltip label={minimizeLabel}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={minimizeLabel}
          onClick={onMinimize}
        >
          <Minus className="size-3.5" />
        </Button>
      </AgentHubActionTooltip>
      <AgentHubActionTooltip label={closeLabel}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </AgentHubActionTooltip>
    </div>
  )
}
