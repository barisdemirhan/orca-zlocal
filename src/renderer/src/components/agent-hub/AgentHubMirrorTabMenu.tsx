import { useRef } from 'react'
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
import { readAgentHubMirrors, useAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubMirrorTabId } from './AgentHubMirrorTabStrip'
import { moveAgentHubMirrorTab, detachAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { mirrorTabTransferFeedback } from './agent-hub-mirror-transfer-feedback'
import { readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { agentHubMirrorTabCapReason } from './agent-hub-mirror-tab-actions'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
    <Tooltip>
      <TooltipTrigger asChild>
        <ContextMenuItem
          disabled={full}
          onSelect={onSelect}
          aria-label={full ? `${title}, ${agentHubMirrorTabCapReason()}` : undefined}
          title={full ? agentHubMirrorTabCapReason() : undefined}
        >
          <span className="max-w-48 truncate">{title}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {translate('agentHub.mirror.tabCount', '{{value0}} tabs', {
              count: window.tabs.length,
              value0: window.tabs.length
            })}
          </span>
        </ContextMenuItem>
      </TooltipTrigger>
      <TooltipContent respectReducedMotion>
        {full ? agentHubMirrorTabCapReason() : title}
      </TooltipContent>
    </Tooltip>
  )
}

export function AgentHubMirrorTabMenu({
  windowId,
  entryId,
  onReveal,
  onShowInSidebar,
  onClose,
  children
}: {
  windowId: string
  entryId: string
  /** Jumps to the terminal in its workspace; absent for a window's only tab (its header has it). */
  onReveal?: () => void
  onShowInSidebar?: () => void
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const { windows } = useAgentHubMirrors()
  const keyboardOrigin = useRef<HTMLElement | null>(null)
  const destinations = windows.filter((window) => window.id !== windowId)
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onKeyDown={(event) => {
          if (
            event.nativeEvent.isComposing ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            !(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) ||
            !(event.target instanceof HTMLElement)
          ) {
            return
          }
          event.preventDefault()
          event.stopPropagation()
          keyboardOrigin.current = event.target
          const rect = event.target.getBoundingClientRect()
          event.currentTarget.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.bottom
            })
          )
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        data-agent-hub-no-tab-drop
        respectReducedMotion
        onCloseAutoFocus={(event) => {
          if (keyboardOrigin.current) {
            event.preventDefault()
            if (keyboardOrigin.current.isConnected) {
              keyboardOrigin.current.focus({ preventScroll: true })
            } else {
              const source = readAgentHubMirrors().windows.find((window) => window.id === windowId)
              const neighbour = source
                ? document.getElementById(agentHubMirrorTabId(source.activeTabId))
                : null
              const moved = document.getElementById(agentHubMirrorTabId(entryId))
              const next = moved ?? neighbour
              next?.focus({ preventScroll: true })
            }
            keyboardOrigin.current = null
          }
        }}
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={!destinations.length}>
            {translate('agentHub.mirror.moveToMirror', 'Move to mirror')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent
            data-agent-hub-no-tab-drop
            respectReducedMotion
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
        {onReveal || onShowInSidebar ? <ContextMenuSeparator /> : null}
        {onShowInSidebar ? (
          <ContextMenuItem onSelect={onShowInSidebar}>
            {translate('agentHub.mirror.showInSidebar', 'Show in sidebar')}
          </ContextMenuItem>
        ) : null}
        {onReveal ? (
          <ContextMenuItem onSelect={onReveal}>
            {translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onClose}>
          {translate('agentHub.mirror.closeTab', 'Close tab')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
