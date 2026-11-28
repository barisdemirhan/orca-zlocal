import { AgentHubActionTooltip } from './AgentHubShortcut'
import { Expand, Shrink } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { toggleAgentHubMirrorFocus } from './agent-hub-mirror-store'

/**
 * A mirror header's focus switch: brings this mirror forward over the whole work area, with the
 * other mirrors and whatever is behind them in shadow; again returns it to its place.
 */
export function AgentHubMirrorFocusButton({
  mirrorKey,
  focused
}: {
  mirrorKey: string
  focused: boolean
}): React.JSX.Element {
  const label = focused
    ? translate('agentHub.mirror.endFocus', 'Return this mirror to its place')
    : translate('agentHub.mirror.focus', 'Focus this mirror')
  return (
    <AgentHubActionTooltip label={label} actionId="agentHub.focusMirror">
      <button
        type="button"
        aria-label={label}
        aria-pressed={focused}
        onClick={(event) => {
          toggleAgentHubMirrorFocus(mirrorKey)
          if (!focused) {
            // Typing goes to the mirror just brought forward, not to one now in shadow.
            event.currentTarget
              .closest('[data-agent-hub-mirror]')
              ?.querySelector<HTMLElement>('.xterm-helper-textarea')
              ?.focus()
          }
        }}
        // Why z-40: over the shadow (z-30), so a mirror in shadow can still be focused in one click.
        className="relative z-40 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground aria-pressed:text-foreground"
      >
        {focused ? <Shrink className="size-3.5" /> : <Expand className="size-3.5" />}
      </button>
    </AgentHubActionTooltip>
  )
}
