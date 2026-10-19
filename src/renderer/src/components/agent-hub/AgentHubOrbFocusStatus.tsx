import { ArrowUpRight, Eye, EyeOff, Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { Fragment } from 'react'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  toggleAgentHubOrbPin,
  toggleAgentHubOrbWatch,
  useAgentHubOrbFocusStore
} from './agent-hub-orb-focus-store'

export function AgentHubOrbFocusStatus({
  onOpenTarget
}: {
  onOpenTarget: (target: AgentHubPaneTarget) => void
}): React.JSX.Element | null {
  const watches = useAgentHubOrbFocusStore((state) => state.watches)
  const pinned = useAgentHubOrbFocusStore((state) => state.pinned)
  if (!watches.size && !pinned) {
    return null
  }
  return (
    <div
      data-agent-hub-orb-interactive
      data-agent-hub-orb-focus-status
      className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground"
    >
      {watches.size ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="xs">
              <Eye />
              {translate('agentHub.orb.follow.count', '{{count}} agents followed · 30 min', {
                count: watches.size
              })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            data-agent-hub-orb-interactive
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <DropdownMenuLabel>
              {translate('agentHub.orb.follow.list', 'Following with Orb')}
            </DropdownMenuLabel>
            {Array.from(watches, ([key, watch], index) => (
              <Fragment key={key}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onSelect={() => onOpenTarget(watch.target)}>
                  <ArrowUpRight />
                  <span className="max-w-56 truncate">{watch.target.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {translate('agentHub.orb.focus.open', 'Open')}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleAgentHubOrbWatch(watch.target)}>
                  <EyeOff />
                  {translate('agentHub.orb.follow.stop', 'Stop following')}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {pinned ? (
        <div className="flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border px-2 py-1">
          <Pin className="size-3 shrink-0" aria-hidden />
          <span className="max-w-48 truncate" title={pinned.target.title}>
            {pinned.target.title}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.orb.focus.openPinned', 'Open pinned target')}
            title={translate('agentHub.orb.focus.openPinned', 'Open pinned target')}
            onClick={() => onOpenTarget(pinned.target)}
          >
            <ArrowUpRight />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.orb.focus.unpin', 'Unpin Orb target')}
            title={translate('agentHub.orb.focus.unpin', 'Unpin Orb target')}
            onClick={() => toggleAgentHubOrbPin(pinned.target)}
          >
            <PinOff />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
