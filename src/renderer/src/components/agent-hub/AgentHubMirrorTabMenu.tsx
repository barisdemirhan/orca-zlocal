import { translate } from '@/i18n/i18n'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import {
  activeAgentHubMirrorTab,
  AGENT_HUB_MIRROR_TAB_CAP,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import { moveAgentHubMirrorTab, detachAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { mirrorTabTransferFeedback } from './agent-hub-mirror-transfer-feedback'
import { readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { agentHubMirrorTabCapReason } from './agent-hub-mirror-tab-actions'

function Destination({
  window,
  onSelect
}: {
  window: AgentHubMirrorWindowState
  onSelect: () => void
}): React.JSX.Element {
  const title = useAgentHubTargetTitle(activeAgentHubMirrorTab(window).target)
  const full = window.tabs.length >= AGENT_HUB_MIRROR_TAB_CAP
  return (
    <ContextMenuItem
      disabled={full}
      onSelect={onSelect}
      title={full ? agentHubMirrorTabCapReason() : undefined}
    >
      <span className="max-w-48 truncate">{title}</span>
      <span className="ml-auto text-xs text-muted-foreground">
        {translate('agentHub.mirror.tabCount', '{{value0}} tabs', { value0: window.tabs.length })}
      </span>
    </ContextMenuItem>
  )
}

export function AgentHubMirrorTabMenu({
  windowId,
  entryId,
  onClose,
  children
}: {
  windowId: string
  entryId: string
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const { windows } = useAgentHubMirrors()
  const destinations = windows.filter((window) => window.id !== windowId)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        data-agent-hub-no-tab-drop
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={!destinations.length}>
            {translate('agentHub.mirror.moveToMirror', 'Move to mirror')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent
            data-agent-hub-no-tab-drop
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            {destinations.map((window) => (
              <Destination
                key={window.id}
                window={window}
                onSelect={() =>
                  mirrorTabTransferFeedback(
                    moveAgentHubMirrorTab(windowId, entryId, window.id, window.tabs.length)
                  )
                }
              />
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          onSelect={() => {
            const source = readAgentHubMirrorOrigin(windowId)
            mirrorTabTransferFeedback(
              detachAgentHubMirrorTab(windowId, entryId, {
                x: (source?.x ?? 0) + 28,
                y: (source?.y ?? 0) + 28
              })
            )
          }}
        >
          {translate('agentHub.mirror.openInNew', 'Open in new mirror')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onClose}>
          {translate('agentHub.mirror.returnToWorkspace', 'Return to workspace')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
