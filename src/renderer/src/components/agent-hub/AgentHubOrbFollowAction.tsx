import { Eye, EyeOff, Orbit, Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  agentHubOrbTargetKey,
  toggleAgentHubOrbPin,
  toggleAgentHubOrbWatch,
  useAgentHubOrbFocusStore
} from './agent-hub-orb-focus-store'

export function AgentHubOrbFollowAction({
  target,
  appearance = 'header',
  isOpeningClick
}: {
  target: AgentHubPaneTarget
  appearance?: 'row' | 'header' | 'menu'
  isOpeningClick?: () => boolean
}): React.JSX.Element {
  const key = agentHubOrbTargetKey(target)
  const watching = useAgentHubOrbFocusStore((state) => state.watches.has(key))
  const pinned = useAgentHubOrbFocusStore(
    (state) => state.pinned !== null && agentHubOrbTargetKey(state.pinned.target) === key
  )
  const WatchIcon = watching ? EyeOff : Eye
  const PinIcon = pinned ? PinOff : Pin
  const watchLabel = watching
    ? translate('agentHub.orb.follow.stop', 'Stop following')
    : translate('agentHub.orb.follow.start', 'Follow with Orb')
  const pinLabel = pinned
    ? translate('agentHub.orb.focus.unpin', 'Unpin Orb target')
    : translate('agentHub.orb.focus.pin', 'Pin Orb target')
  const watchContent = (
    <>
      <WatchIcon />
      <span>{watchLabel}</span>
      {!watching ? (
        <span className="ml-auto text-xs text-muted-foreground">
          {translate('agentHub.orb.follow.duration', '30 min')}
        </span>
      ) : null}
    </>
  )
  const pinContent = (
    <>
      <PinIcon />
      <span>{pinLabel}</span>
      {!pinned ? (
        <span className="ml-auto text-xs text-muted-foreground">
          {translate('agentHub.orb.focus.duration', '60 min')}
        </span>
      ) : null}
    </>
  )
  const select = (event: Event, toggle: (target: AgentHubPaneTarget) => void): void => {
    if (isOpeningClick?.()) {
      event.preventDefault()
      return
    }
    toggle(target)
  }
  if (appearance === 'menu') {
    return (
      <>
        <ContextMenuItem onSelect={(event) => select(event, toggleAgentHubOrbWatch)}>
          {watchContent}
        </ContextMenuItem>
        <ContextMenuItem onSelect={(event) => select(event, toggleAgentHubOrbPin)}>
          {pinContent}
        </ContextMenuItem>
      </>
    )
  }
  const label = translate('agentHub.orb.follow.actions', 'Orb follow and target')
  return (
    <DropdownMenu>
      <span
        className={cn(
          appearance === 'row' &&
            !watching &&
            !pinned &&
            'opacity-0 transition-opacity group-hover/row:opacity-100 group-data-[selected=true]/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100'
        )}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={watching || pinned ? 'secondary' : 'ghost'}
            size="icon-xs"
            aria-label={label}
            title={label}
            data-agent-hub-orb-follow={watching}
            data-agent-hub-orb-pinned={pinned}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {pinned ? (
              <Pin className="size-3.5" />
            ) : watching ? (
              <Eye className="size-3.5" />
            ) : (
              <Orbit className="size-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </span>
      <DropdownMenuContent
        align="end"
        data-agent-hub-orb-interactive
        data-agent-hub-no-tab-drop
        onClick={(event) => event.stopPropagation()}
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onSelect={() => toggleAgentHubOrbWatch(target)}>
          {watchContent}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggleAgentHubOrbPin(target)}>
          {pinContent}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
