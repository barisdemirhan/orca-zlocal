import { Minus, PictureInPicture2, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip, AgentHubShortcut } from './AgentHubShortcut'
import { AgentHubArrangeMenu } from './AgentHubArrangeMenu'
import { AgentHubDimToggle } from './AgentHubDimToggle'
import { AgentHubMirrorFocusButton } from './AgentHubMirrorFocusButton'
import { AgentHubMirrorMicButton } from './AgentHubMirrorMicButton'
import { requestAgentHubMirrorsDock } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function AgentHubMirrorHeaderControls({
  target,
  reachable,
  mirrorKey,
  focused,
  onReveal,
  onMinimize,
  onClose
}: {
  target: AgentHubPaneTarget
  reachable: boolean
  mirrorKey: string
  focused: boolean
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
      <AgentHubActionTooltip
        label={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
        actionId="agentHub.jumpToMirror"
      >
        <button
          type="button"
          onClick={onReveal}
          className="flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          {translate('agentHub.mirror.jump', 'Jump')}
          <AgentHubShortcut actionId="agentHub.jumpToMirror" />
        </button>
      </AgentHubActionTooltip>
      <AgentHubArrangeMenu>
        <AgentHubActionTooltip label={dockLabel} actionId="agentHub.dockMirrors">
          <button
            type="button"
            aria-label={dockLabel}
            onClick={() => requestAgentHubMirrorsDock()}
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
          >
            <PictureInPicture2 className="size-3.5" />
          </button>
        </AgentHubActionTooltip>
      </AgentHubArrangeMenu>
      <AgentHubMirrorFocusButton mirrorKey={mirrorKey} focused={focused} />
      <AgentHubActionTooltip label={minimizeLabel}>
        <button
          type="button"
          aria-label={minimizeLabel}
          onClick={onMinimize}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
      </AgentHubActionTooltip>
      <AgentHubActionTooltip label={closeLabel}>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </AgentHubActionTooltip>
    </div>
  )
}
