import { PictureInPicture2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import {
  toggleAgentHubTabAutoPopout,
  useIsAgentHubTabAutoPopout
} from './agent-hub-tab-auto-popout'

/**
 * A terminal tab's "pop out when I leave" switch, beside its close button. Renders nothing
 * unless the Agent Hub and its tab-toggle setting are both on, so the tab strip is unchanged
 * for everyone else.
 */
export function AgentHubTabAutoPopoutToggle({
  tabId,
  worktreeId,
  isActive
}: {
  tabId: string
  worktreeId: string
  isActive: boolean
}): React.JSX.Element | null {
  const shown = useAppStore(
    (s) => s.settings?.experimentalAgentHub === true && s.settings.agentHubTabAutoPopout === true
  )
  const on = useIsAgentHubTabAutoPopout(tabId)
  // The floating workspace draws its own terminals; its tabs are never "left" for a workspace.
  if (!shown || worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    return null
  }
  const label = on
    ? translate('agentHub.tabToggle.on', 'Pops out when you leave this tab (click to stop)')
    : translate('agentHub.tabToggle.off', 'Pop this terminal out when you leave the tab')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={on}
          data-on={on}
          data-active={isActive}
          data-agent-hub-tab-auto-popout
          // Why stop: the tab must not activate, start a drag or rename from this button.
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            toggleAgentHubTabAutoPopout(tabId)
          }}
          // Like the close button: quiet until the tab is hovered or active; lit while on.
          className="relative z-10 mr-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm text-transparent group-hover:text-muted-foreground hover:bg-muted hover:!text-foreground focus-visible:bg-muted focus-visible:!text-foreground data-[active=true]:text-muted-foreground data-[on=true]:bg-foreground/10 data-[on=true]:text-foreground"
        >
          <PictureInPicture2 className="size-3" />
          {/* On reads at a glance, on any tab: a green dot on the icon's corner. */}
          {on ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-status-success ring-1 ring-background"
            />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
