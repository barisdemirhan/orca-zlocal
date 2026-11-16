import { createPortal } from 'react-dom'
import { PanelLeft, PictureInPicture2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentHubActionTooltip, AgentHubShortcut } from './AgentHubShortcut'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { MAC_TRAFFIC_LIGHTS_WIDTH } from '@/app-shell/app-window-chrome'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../sidebar/workspace-chrome-metrics'
import { AgentHubCanvasLayoutSwitch } from './AgentHubCanvasLayoutSwitch'
import { AgentHubCanvasFocusShade } from './AgentHubMirrorFocusShade'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'

/**
 * The page mirrors live on while the canvas setting is on: a dotted surface over the main
 * area, from the left sidebar to the window's right edge and from the window's top (the tab
 * strip included) down to the status bar. It hides the workspace behind it, so nothing there is
 * hit by accident; its own top strip still drags the window.
 */
export function AgentHubCanvas({
  empty,
  onLeave
}: {
  empty: boolean
  /** Back to the page behind; the mirrors park beside the hub. */
  onLeave: () => void
}): React.JSX.Element {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const statusBarHeight = useAppStore((s) => (s.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0))
  return createPortal(
    <div
      data-agent-hub-canvas
      // Why: the hub portals out of the status bar, whose menu would take this right-click.
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      style={{
        // Why the live width: the sidebar's own width is committed only when a resize ends.
        left: sidebarOpen ? `var(--workspace-sidebar-live-width, ${sidebarWidth}px)` : 0,
        bottom: statusBarHeight
      }}
      // Why preventDefault: a click on the canvas must not pull focus off the mirror typed in.
      onMouseDown={(event) => event.preventDefault()}
      // Why z-[43]: the dim's layer (unused here), below the mirrors (44) and the dock (47).
      className="fixed top-0 right-0 z-[43] animate-in bg-background bg-[radial-gradient(circle,color-mix(in_srgb,var(--foreground)_14%,transparent)_1px,transparent_1px)] bg-size-[22px_22px] duration-150 fade-in-0"
    >
      {/* First, so the canvas's own controls stay lit and usable over it. */}
      <AgentHubCanvasFocusShade />
      {/* Why: the canvas covers the title-bar row, which is what moves the window. */}
      <div
        aria-hidden
        style={{ height: WORKSPACE_TOP_CHROME_HEIGHT }}
        className="absolute inset-x-0 top-0 [-webkit-app-region:drag]"
      />
      {sidebarOpen ? null : (
        // The title bar's own sidebar switch is under the canvas; this one stands in for it,
        // clear of the macOS window buttons.
        <AgentHubActionTooltip
          label={translate('agentHub.canvas.showSidebar', 'Show the sidebar')}
          actionId="sidebar.left.toggle"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={translate('agentHub.canvas.showSidebar', 'Show the sidebar')}
            onClick={() => setSidebarOpen(true)}
            style={{ left: `calc(${MAC_TRAFFIC_LIGHTS_WIDTH} + 8px)` }}
            className="absolute top-1 [-webkit-app-region:no-drag]"
          >
            <PanelLeft />
          </Button>
        </AgentHubActionTooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={translate('agentHub.canvas.leave', 'Leave the canvas')}
            onClick={onLeave}
            // Clear of the Windows/Linux window buttons, which sit over this corner.
            style={{ right: 'calc(var(--window-controls-width, 0px) + 8px)' }}
            className="absolute top-1 [-webkit-app-region:no-drag]"
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={4}>
          {translate('agentHub.canvas.leave', 'Leave the canvas')}
          <AgentHubShortcut actionId="agentHub.toggleCanvas" />
        </TooltipContent>
      </Tooltip>
      <AgentHubCanvasLayoutSwitch />
      {empty ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
          <PictureInPicture2 className="size-7 text-muted-foreground" />
          <div className="text-sm font-semibold">
            {translate('agentHub.canvas.emptyTitle', 'No mirrors on the canvas')}
          </div>
          <p className="max-w-85 text-xs text-muted-foreground">
            {translate(
              'agentHub.canvas.emptyHint',
              'Pop out a terminal from the hub, or bring a parked mirror back, and it opens here.'
            )}
          </p>
        </div>
      ) : null}
    </div>,
    document.body
  )
}
