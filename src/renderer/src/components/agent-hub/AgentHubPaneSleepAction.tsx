import { useState } from 'react'
import { Loader2, Moon, Pause, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubPaneSleep } from './agent-hub-pane-sleep'
import { useAgentHubPaneSleepConfirmation } from './agent-hub-pane-sleep-confirmation'

export function AgentHubPaneSleepAction({
  target,
  appearance = 'header',
  isOpeningClick,
  returnFocus
}: {
  target: AgentHubPaneTarget
  appearance?: 'row' | 'header' | 'menu'
  isOpeningClick?: () => boolean
  returnFocus?: () => HTMLElement | null
}): React.JSX.Element {
  const state = useAgentHubPaneSleep(target)
  const [error, setError] = useState<string | null>(null)
  const sleeping = state.phase === 'sleeping'
  const pending = state.phase === 'sleeping-pending' || state.phase === 'waking'
  const disabled = pending || state.phase === 'unverifiable' || (!sleeping && !state.canSleep)
  const label =
    state.phase === 'waking'
      ? translate('agentHub.sleep.waking', 'Waking…')
      : pending
        ? translate('agentHub.sleep.pending', 'Putting to sleep…')
        : state.phase === 'unverifiable'
          ? translate('agentHub.sleep.unverifiable', 'Host unavailable')
          : sleeping
            ? translate('agentHub.sleep.wake', 'Wake')
            : translate('agentHub.sleep.action', 'Sleep')
  const Icon = pending ? Loader2 : sleeping ? Sun : state.kind === 'agent' ? Moon : Pause
  const activate = (origin?: HTMLElement): void => {
    setError(null)
    if (!sleeping) {
      useAgentHubPaneSleepConfirmation.getState().request(target, returnFocus?.() ?? origin)
      return
    }
    void state.wake().catch((failure: unknown) => {
      setError(
        failure instanceof Error
          ? failure.message
          : translate('agentHub.sleep.wakeFailed', 'Could not wake this pane. Try again.')
      )
    })
  }
  const detail = error ?? state.error ?? state.reason ?? label
  const icon = (
    <Icon className={cn('size-3.5', pending && 'animate-spin motion-reduce:animate-none')} />
  )
  if (appearance === 'menu') {
    return (
      <ContextMenuItem
        disabled={disabled}
        title={detail}
        onSelect={(event) => {
          if (isOpeningClick?.()) {
            event.preventDefault()
            return
          }
          activate()
        }}
      >
        {icon}
        <span>{label}</span>
        {disabled && state.reason ? (
          <span className="max-w-48 truncate text-xs text-muted-foreground">{state.reason}</span>
        ) : null}
      </ContextMenuItem>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0',
            appearance === 'row' &&
              state.phase === 'awake' &&
              'opacity-0 transition-opacity group-hover/row:opacity-100 group-data-[selected=true]/row:opacity-100 focus-within:opacity-100'
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size={appearance === 'row' && sleeping ? 'xs' : 'icon-xs'}
            disabled={disabled}
            aria-label={label}
            aria-description={detail}
            data-agent-hub-sleep-action={state.phase}
            onClick={(event) => {
              event.stopPropagation()
              activate(event.currentTarget)
            }}
          >
            {icon}
            {appearance === 'row' && sleeping ? label : null}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent respectReducedMotion>{detail}</TooltipContent>
    </Tooltip>
  )
}
