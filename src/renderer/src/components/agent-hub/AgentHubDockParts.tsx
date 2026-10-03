import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AgentHubDockEdge } from '../../../../shared/agent-hub-settings'
import type { AgentHubCounts } from './agent-hub-lists'

export const DOCK_BUTTON =
  'relative grid size-8 shrink-0 animate-in place-items-center rounded-full text-muted-foreground duration-300 fade-in-0 hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-40 motion-reduce:animate-none'
export const DOCK_COUNT_BUTTON =
  'flex h-8 shrink-0 animate-in items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] text-muted-foreground duration-300 fade-in-0 hover:bg-foreground/[0.07] hover:text-foreground motion-reduce:animate-none'

function CounterIndicator({
  kind,
  active
}: {
  kind: 'ask' | 'work' | 'done'
  active: boolean
}): React.JSX.Element {
  if (kind === 'work' && active) {
    return <AgentWorkingSpinner className="size-2.5 shrink-0" />
  }
  return (
    <span
      aria-hidden
      data-kind={kind}
      data-active={active}
      className="size-2 shrink-0 rounded-full data-[active=true]:data-[kind=ask]:animate-pulse data-[kind=ask]:bg-agent-question data-[kind=done]:bg-status-success data-[kind=work]:border-[1.5px] data-[kind=work]:border-status-warning"
    />
  )
}

/** "● 2" — always shown, dimmed at zero, so the dock reads the same whether busy or idle. */
export function DockCounter({
  kind,
  value
}: {
  kind: 'ask' | 'work' | 'done'
  value: number
}): React.JSX.Element {
  return (
    <span
      data-zero={value === 0}
      className="flex shrink-0 items-center gap-1 font-mono text-[10.5px] text-muted-foreground tabular-nums data-[zero=true]:opacity-45 group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col"
    >
      <CounterIndicator kind={kind} active={value > 0} />
      {value}
    </span>
  )
}

export function DockCounters({ counts }: { counts: AgentHubCounts }): React.JSX.Element {
  return (
    <>
      <DockCounter kind="work" value={counts.working} />
      <DockCounter kind="ask" value={counts.needsYou} />
      <DockCounter kind="done" value={counts.finished} />
    </>
  )
}

export function DockButton({
  label,
  side,
  className,
  disabled,
  onClick,
  children
}: {
  label: string
  side: 'top' | 'bottom' | 'left' | 'right'
  className: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={className}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** A concave fillet, with the hairline continuing along its curve into the bar it grows from. */
function fillet(at: string): React.CSSProperties {
  return {
    background: `radial-gradient(circle at ${at}, transparent 9.5px, var(--border) 10px, var(--border) 10.5px, transparent 11px), radial-gradient(circle at ${at}, transparent 9.5px, var(--hub-notch) 10px)`
  }
}

/** The two fillets where the notch meets the status bar, the title bar or a window edge. */
export function NotchCorners({ edge }: { edge: AgentHubDockEdge }): React.JSX.Element {
  switch (edge) {
    case 'bottom':
      return (
        <>
          <span
            aria-hidden
            className="absolute bottom-0 -left-2.5 size-2.5"
            style={fillet('0 0')}
          />
          <span
            aria-hidden
            className="absolute -right-2.5 bottom-0 size-2.5"
            style={fillet('100% 0')}
          />
        </>
      )
    case 'top':
      return (
        <>
          <span
            aria-hidden
            className="absolute top-0 -left-2.5 size-2.5"
            style={fillet('0 100%')}
          />
          <span
            aria-hidden
            className="absolute top-0 -right-2.5 size-2.5"
            style={fillet('100% 100%')}
          />
        </>
      )
    case 'right':
      return (
        <>
          <span aria-hidden className="absolute -top-2.5 right-0 size-2.5" style={fillet('0 0')} />
          <span
            aria-hidden
            className="absolute right-0 -bottom-2.5 size-2.5"
            style={fillet('0 100%')}
          />
        </>
      )
    case 'left':
      return (
        <>
          <span
            aria-hidden
            className="absolute -top-2.5 left-0 size-2.5"
            style={fillet('100% 0')}
          />
          <span
            aria-hidden
            className="absolute -bottom-2.5 left-0 size-2.5"
            style={fillet('100% 100%')}
          />
        </>
      )
  }
}
