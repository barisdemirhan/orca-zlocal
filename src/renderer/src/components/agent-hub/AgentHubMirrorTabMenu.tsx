import { useAgentHubPaneSleepConfirmation } from './agent-hub-pane-sleep-confirmation'
import { AgentHubPaneSleepAction } from './AgentHubPaneSleepAction'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { Pin, PinOff, X } from 'lucide-react'
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
import {
  moveAgentHubMirrorTab,
  detachAgentHubMirrorTab,
  toggleAgentHubMirrorTabPin
} from './agent-hub-mirror-tab-operations'
import { mirrorTabTransferFeedback } from './agent-hub-mirror-transfer-feedback'
import { readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { agentHubMirrorTabCapReason } from './agent-hub-mirror-tab-actions'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMenuOpeningClickGuard } from './use-menu-opening-click-guard'
import { useAppStore } from '@/store'
import { TabSessionSurfaceSwitchMenuItems } from '../tab-bar/session-actions/TabSessionSurfaceSwitchMenuItems'
import { useSortableTabContextMenu } from '../tab-bar/terminal-tabs/use-sortable-tab-context-menu'
import { agentHubChatSession, findAgentHubChatTab } from './agent-hub-chat-tabs'
import {
  agentHubChatSwitchBlockedReason,
  useAgentHubChatWorking
} from './agent-hub-chat-work-state'

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
  target,
  switchTarget,
  onReveal,
  onShowInSidebar,
  onClose,
  onCloseAgent,
  isAgent = false,
  children
}: {
  windowId: string
  entryId: string
  target?: AgentHubPaneTarget
  /** The tab whose terminal and chat views the menu switches between. */
  switchTarget?: AgentHubPaneTarget
  /** Jumps to the terminal in its workspace; absent for a window's only tab (its header has it). */
  onReveal?: () => void
  onShowInSidebar?: () => void
  onClose: () => void
  onCloseAgent?: () => void
  isAgent?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const { windows } = useAgentHubMirrors()
  const openingClick = useMenuOpeningClickGuard()
  const menu = useSortableTabContextMenu()
  const switchChat = useAppStore((state) =>
    switchTarget ? findAgentHubChatTab(state, switchTarget.tab.id) : null
  )
  const switchChatWorking = useAgentHubChatWorking(switchChat?.id ?? null)
  const keyboardOrigin = useRef<HTMLElement | null>(null)
  const isPinned =
    windows.find((window) => window.id === windowId)?.tabs.find((tab) => tab.id === entryId)
      ?.isPinned === true
  const destinations = windows.filter((window) => window.id !== windowId)
  return (
    <ContextMenu
      open={menu.open}
      onOpenChange={(open) => {
        menu.onOpenChange(open)
        openingClick.noteOpenChange(open)
      }}
    >
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
          if (useAgentHubPaneSleepConfirmation.getState().target) {
            event.preventDefault()
            keyboardOrigin.current = null
            return
          }
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
        {target ? (
          <AgentHubPaneSleepAction
            target={target}
            appearance="menu"
            isOpeningClick={openingClick.isOpeningClick}
            returnFocus={() => document.getElementById(agentHubMirrorTabId(entryId))}
          />
        ) : null}
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
        {switchTarget ? (
          <TabSessionSurfaceSwitchMenuItems
            key={menu.openingId}
            tab={{ id: switchTarget.tab.id, worktreeId: switchTarget.worktree.id }}
            nativeChat={switchChat ? agentHubChatSession(switchChat) : undefined}
            leadingSeparator
            onComplete={menu.onComplete}
            fromMirror
            chatBlockedReason={switchChatWorking ? agentHubChatSwitchBlockedReason() : undefined}
          />
        ) : null}
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
        <ContextMenuItem onSelect={() => toggleAgentHubMirrorTabPin(windowId, entryId)}>
          {isPinned ? <PinOff /> : <Pin />}
          {isPinned
            ? translate('auto.components.tab.bar.SortableTabContextMenu.417722e9c2', 'Unpin Tab')
            : translate('auto.components.tab.bar.SortableTabContextMenu.60f958ec75', 'Pin Tab')}
        </ContextMenuItem>
        {onCloseAgent ? (
          <ContextMenuItem
            onSelect={(event) => {
              if (openingClick.isOpeningClick()) {
                event.preventDefault()
                return
              }
              onCloseAgent()
            }}
          >
            <X />
            {isAgent
              ? translate('agentHub.row.closeAgent', 'Close agent')
              : translate('agentHub.row.closeShell', 'Close terminal')}
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem disabled={isPinned} onSelect={() => !isPinned && onClose()}>
          {translate('agentHub.mirror.closeTab', 'Close tab')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
