import { AGENT_HUB_DIM_MODES, agentHubDimModeLabel } from './agent-hub-dim-mode-options'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb, LightbulbOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/components/floating-terminal/floating-terminal'
import { useAppStore } from '@/store'
import {
  agentHubFloatingDimMode,
  type AgentHubFloatingDimMode
} from '../../../../shared/agent-hub-settings'
import { STATUS_BAR_RESERVE_HEIGHT } from '../sidebar/workspace-chrome-metrics'
import {
  setFloatingWindowsSpotlit,
  useAnyFloatingWindowOpen,
  useFloatingWindowPresence,
  useFloatingWindowsSpotlit
} from './agent-hub-floating-dim'
import { useAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { requestAgentHubMirrorsDock } from './agent-hub-mirror-store'

const FLOATING_WINDOW = '[data-agent-hub-mirror], [data-floating-terminal-panel]'
function useDimMode(): AgentHubFloatingDimMode {
  return useAppStore((s) => agentHubFloatingDimMode(s.settings))
}

/**
 * The spotlight switch every floating window carries (HazeOver-style): how everything behind
 * floating windows is dimmed. One setting, so changing it in any window changes it in all.
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
  const mode = useDimMode()
  const updateSettings = useAppStore((s) => s.updateSettings)
  useFloatingWindowPresence(showing)
  // The canvas hides everything behind the floating windows; there is nothing to dim.
  const onCanvas = useAgentHubCanvasOpen()
  if (!hubEnabled || onCanvas) {
    return null
  }
  const label = `${translate('agentHub.dim.title', 'Dim behind floating windows')}: ${agentHubDimModeLabel(mode)}`
  const icon =
    mode === 'off' ? <Lightbulb className="size-3.5" /> : <LightbulbOff className="size-3.5" />
  return (
    <DropdownMenu>
      <AgentHubActionTooltip label={label}>
        <DropdownMenuTrigger asChild>
          {appearance === 'panel' ? (
            <Button type="button" variant="outline" size="icon-xs" aria-label={label}>
              {icon}
            </Button>
          ) : (
            <button
              type="button"
              aria-label={label}

              data-active={mode !== 'off'}
              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground data-[active=true]:text-status-warning"
            >
              {icon}
            </button>
          )}
        </DropdownMenuTrigger>
      </AgentHubActionTooltip>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          {translate('agentHub.dim.title', 'Dim behind floating windows')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => {
            const next = AGENT_HUB_DIM_MODES.find((candidate) => candidate === value)
            if (next) {
              void updateSettings({ agentHubFloatingDimMode: next })
            }
          }}
        >
          {AGENT_HUB_DIM_MODES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {agentHubDimModeLabel(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The dim itself: under every floating window, over the rest. While shown it takes the clicks
 * meant for what it covers (an embedded browser included), so nothing behind is hit by accident;
 * in "until I click" mode such a click lifts it, and a click on a floating window brings it back;
 * in "minimize" mode it sends the mirrors to the hub and hides the floating workspace.
 */
export function AgentHubDimBackdrop({ hidden }: { hidden: boolean }): React.JSX.Element {
  const mode = useDimMode()
  const anyFloating = useAnyFloatingWindowOpen()
  const spotlit = useFloatingWindowsSpotlit()
  // The status bar stays lit and usable: the dock grows out of it, and it is app chrome.
  const statusBarHeight = useAppStore((s) => (s.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0))
  useEffect(() => {
    if (mode !== 'untilClick') {
      return
    }
    setFloatingWindowsSpotlit(true)
    const noteFloating = (target: EventTarget | null): void => {
      if (target instanceof Element && target.closest(FLOATING_WINDOW)) {
        setFloatingWindowsSpotlit(true)
      }
    }
    const onFloating = (event: Event): void => noteFloating(event.target)
    // Why blur: a click inside a loaded page in an embedded browser reaches this document only as
    // the window losing focus to that browser element.
    const onBlur = (): void => noteFloating(document.activeElement)
    window.addEventListener('pointerdown', onFloating, true)
    window.addEventListener('focusin', onFloating, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onFloating, true)
      window.removeEventListener('focusin', onFloating, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [mode])
  const visible = mode !== 'off' && anyFloating && (mode === 'on' || spotlit) && !hidden
  return createPortal(
    <div
      aria-hidden
      data-visible={visible}
      style={{ bottom: statusBarHeight }}
      // Why preventDefault: a click on the dim must not pull focus off the window being typed in.
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault()
        if (mode === 'untilClick') {
          setFloatingWindowsSpotlit(false)
        } else if (mode === 'minimizeOnClick') {
          requestAgentHubMirrorsDock()
          // The floating workspace has no tray; it hides the way its status bar button hides it.
          if (document.querySelector('[data-floating-terminal-panel][aria-hidden="false"]')) {
            window.dispatchEvent(new CustomEvent(TOGGLE_FLOATING_TERMINAL_EVENT))
          }
        }
      }}
      // Why z-[43]: below the mirrors (44), floating workspace (45), and hub dock and tray (47).
      className="pointer-events-none fixed inset-x-0 top-0 z-[43] bg-black/45 opacity-0 transition-opacity duration-200 data-[visible=true]:pointer-events-auto data-[visible=true]:opacity-100"
    />,
    document.body
  )
}
