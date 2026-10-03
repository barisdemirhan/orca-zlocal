import { createPortal } from 'react-dom'
import { Lightbulb, LightbulbOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useAnyFloatingWindowOpen, useFloatingWindowPresence } from './agent-hub-floating-dim'

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
export function AgentHubDimBackdrop(): React.JSX.Element {
  const dimmed = useAppStore((s) => s.settings?.agentHubFloatingDim === true)
  const anyFloating = useAnyFloatingWindowOpen()
  return createPortal(
    <div
      aria-hidden
      data-visible={dimmed && anyFloating}
      // Why z-[43]: below the dock (44), the floating workspace (45) and mirrors (46).
      className="pointer-events-none fixed inset-0 z-[43] bg-black/45 opacity-0 transition-opacity duration-200 data-[visible=true]:opacity-100 motion-reduce:transition-none"
    />,
    document.body
  )
}
