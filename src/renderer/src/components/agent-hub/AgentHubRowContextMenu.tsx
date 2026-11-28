import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { AgentHubPaneSleepAction } from './AgentHubPaneSleepAction'
import { AgentHubRenameDialog } from './AgentHubRenameDialog'
import { openAgentHubCanvas } from './agent-hub-canvas-store'
import { setAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/**
 * The right-click menu of an agent or terminal row, built from the row's existing actions. A
 * sleeping row offers Wake, its last chat and Close only.
 */
export function AgentHubRowContextMenu({
  target,
  mirrorKey,
  sleeping,
  unread,
  onJump,
  onPopout,
  onMarkRead,
  onClose,
  children
}: {
  target: AgentHubPaneTarget
  mirrorKey: string
  sleeping: boolean
  unread: boolean
  onJump: () => void
  onPopout: () => void
  onMarkRead?: () => void
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const [renaming, setRenaming] = useState(false)
  const canvasEnabled = useAppStore((s) => s.settings?.agentHubCanvas !== false)
  const close = (
    <ContextMenuItem variant="destructive" onSelect={onClose}>
      {translate('agentHub.rowMenu.close', 'Close')}
    </ContextMenuItem>
  )
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {sleeping ? (
            <>
              <AgentHubPaneSleepAction target={target} appearance="menu" />
              <ContextMenuItem onSelect={onJump}>
                {translate('agentHub.rowMenu.openLastChat', 'Open last chat')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              {close}
            </>
          ) : (
            <>
              <ContextMenuItem onSelect={onJump}>
                {translate('agentHub.rowMenu.jump', 'Jump to terminal')}
                <ContextMenuShortcut>↵</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onSelect={onPopout}>
                {translate('agentHub.rowMenu.mirror', 'Open in mirror')}
                <ContextMenuShortcut>⌥↵</ContextMenuShortcut>
              </ContextMenuItem>
              {canvasEnabled ? (
                <ContextMenuItem
                  onSelect={() => {
                    onPopout()
                    openAgentHubCanvas(true)
                    setAgentHubMirrorFocus(mirrorKey)
                  }}
                >
                  {translate('agentHub.rowMenu.canvas', 'Add to canvas')}
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem onSelect={() => setRenaming(true)}>
                {translate('agentHub.rowMenu.rename', 'Rename…')}
              </ContextMenuItem>
              {unread && onMarkRead ? (
                <ContextMenuItem onSelect={onMarkRead}>
                  {translate('agentHub.rowMenu.markRead', 'Mark read')}
                </ContextMenuItem>
              ) : null}
              <ContextMenuSeparator />
              <AgentHubPaneSleepAction target={target} appearance="menu" />
              {close}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {renaming ? (
        <AgentHubRenameDialog
          tabId={target.tab.id}
          title={target.title}
          heading={translate('agentHub.rowMenu.renameTitle', 'Rename terminal')}
          onOpenChange={setRenaming}
        />
      ) : null}
    </>
  )
}
