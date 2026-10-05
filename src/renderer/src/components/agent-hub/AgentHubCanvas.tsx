import { createPortal } from 'react-dom'
import { PictureInPicture2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../sidebar/workspace-chrome-metrics'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'

/**
 * The page mirrors live on while the canvas setting is on: a dotted surface over the main
 * area, from the left sidebar to the window's right edge, under the title bar and above the
 * status bar. It hides the workspace behind it, so nothing there is hit by accident.
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
  const statusBarHeight = useAppStore((s) => (s.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0))
  const leaveShortcut = useOptionalShortcutLabel('agentHub.toggleCanvas')
  return createPortal(
    <div
      data-agent-hub-canvas
      // Why: the hub portals out of the status bar, whose menu would take this right-click.
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      style={{
        top: WORKSPACE_TOP_CHROME_HEIGHT,
        // Why the live width: the sidebar's own width is committed only when a resize ends.
        left: sidebarOpen ? `var(--workspace-sidebar-live-width, ${sidebarWidth}px)` : 0,
        bottom: statusBarHeight
      }}
      // Why preventDefault: a click on the canvas must not pull focus off the mirror typed in.
      onMouseDown={(event) => event.preventDefault()}
      // Why z-[43]: the dim's layer (unused here), below the dock (44) and the mirrors (46).
      className="fixed right-0 z-[43] animate-in bg-background bg-[radial-gradient(circle,color-mix(in_srgb,var(--foreground)_14%,transparent)_1px,transparent_1px)] bg-size-[22px_22px] duration-150 fade-in-0"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={translate('agentHub.canvas.leave', 'Leave the canvas')}
            onClick={onLeave}
            className="absolute top-2 right-2"
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={4}>
          {translate('agentHub.canvas.leave', 'Leave the canvas')}
          {leaveShortcut ? ` (${leaveShortcut})` : null}
        </TooltipContent>
      </Tooltip>
      {empty ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
          <PictureInPicture2 className="size-7 text-muted-foreground" />
          <div className="text-sm font-semibold">
            {translate('agentHub.canvas.emptyTitle', 'No mirrors on the canvas')}
          </div>
          <p className="max-w-[340px] text-xs text-muted-foreground">
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
