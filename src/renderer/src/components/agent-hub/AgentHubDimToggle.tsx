import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb, LightbulbOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { STATUS_BAR_RESERVE_HEIGHT } from '../sidebar/workspace-chrome-metrics'
import {
  setFloatingWindowsSpotlit,
  useAnyFloatingWindowOpen,
  useFloatingWindowPresence,
  useFloatingWindowsSpotlit
} from './agent-hub-floating-dim'

const FLOATING_WINDOW = '[data-agent-hub-mirror], [data-floating-terminal-panel]'
// The dock, chips, alerts, and menus or popovers opened from any of them neither lift nor restore it.
const NEUTRAL_SURFACE =
  '[data-agent-hub-dock], [data-agent-hub-mirror-chip], [data-agent-hub-alert-stack], [data-radix-popper-content-wrapper], [role="menu"], [role="dialog"]'

/**
 * The spotlight switch every floating window carries (HazeOver-style): it dims everything
 * behind floating windows. One setting, so flipping it in any window flips it in all.
 */
export function AgentHubDimToggle({
  appearance,
  showing = true
}: {
  /** `panel` matches the floating workspace's outline buttons; `mirror` the mirror header. */
  appearance: 'panel' | 'mirror'
  /** False while the window is hidden but still mounted (the floating workspace panel). */
  showing?: boolean
}): React.JSX.Element | null {
  const hubEnabled = useAppStore((s) => s.settings?.experimentalAgentHub === true)
  const dimmed = useAppStore((s) => s.settings?.agentHubFloatingDim === true)
  const updateSettings = useAppStore((s) => s.updateSettings)
  useFloatingWindowPresence(showing)
  if (!hubEnabled) {
    return null
  }
  const label = dimmed
    ? translate('agentHub.dim.off', 'Stop dimming behind floating windows')
    : translate('agentHub.dim.on', 'Dim everything behind floating windows')
  const icon = dimmed ? <LightbulbOff className="size-3.5" /> : <Lightbulb className="size-3.5" />
  const toggle = (): void => void updateSettings({ agentHubFloatingDim: !dimmed })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {appearance === 'panel' ? (
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label={label}
            aria-pressed={dimmed}
            onClick={toggle}
          >
            {icon}
          </Button>
        ) : (
          <button
            type="button"
            aria-label={label}
            aria-pressed={dimmed}
            data-active={dimmed}
            onClick={toggle}
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground data-[active=true]:text-status-warning"
          >
            {icon}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** The dim itself: under every floating window, over the rest; clicks still reach the app. */
export function AgentHubDimBackdrop({ hidden }: { hidden: boolean }): React.JSX.Element {
  const dimmed = useAppStore((s) => s.settings?.agentHubFloatingDim === true)
  const anyFloating = useAnyFloatingWindowOpen()
  const spotlit = useFloatingWindowsSpotlit()
  // The status bar stays lit and usable: the dock grows out of it, and it is app chrome.
  const statusBarHeight = useAppStore((s) => (s.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0))
  useEffect(() => {
    if (!dimmed) {
      return
    }
    setFloatingWindowsSpotlit(true)
    const onPointerDown = (event: PointerEvent): void => {
      if (
        !(event.target instanceof Element) ||
        event.clientY >= window.innerHeight - statusBarHeight
      ) {
        return
      }
      if (event.target.closest(FLOATING_WINDOW)) {
        setFloatingWindowsSpotlit(true)
      } else if (!event.target.closest(NEUTRAL_SURFACE)) {
        setFloatingWindowsSpotlit(false)
      }
    }
    // Why capture: terminals and editors stop propagation of their own pointer events.
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [dimmed, statusBarHeight])
  return createPortal(
    <div
      aria-hidden
      data-visible={dimmed && anyFloating && spotlit && !hidden}
      style={{ bottom: statusBarHeight }}
      // Why z-[43]: below the dock (44), the floating workspace (45) and mirrors (46).
      className="pointer-events-none fixed inset-x-0 top-0 z-[43] bg-black/45 opacity-0 transition-opacity duration-200 data-[visible=true]:opacity-100 motion-reduce:transition-none"
    />,
    document.body
  )
}
