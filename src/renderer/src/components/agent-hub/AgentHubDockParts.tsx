import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AgentHubDockEdge } from '../../../../shared/agent-hub-settings'
import { agentHubNotchShape } from './agent-hub-dock-geometry'
import type { AgentHubCounts } from './agent-hub-lists'

export const DOCK_BUTTON =
  'relative grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-40'
// Why wider than tall: a count's hover reads as a pill, never a tall capsule.
export const DOCK_COUNT_BUTTON =
  'flex h-6 shrink-0 items-center justify-center rounded-full px-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground group-data-[edge=left]/dock:h-auto group-data-[edge=left]/dock:w-6 group-data-[edge=left]/dock:px-0 group-data-[edge=left]/dock:py-1.5 group-data-[edge=right]/dock:h-auto group-data-[edge=right]/dock:w-6 group-data-[edge=right]/dock:px-0 group-data-[edge=right]/dock:py-1.5'

function CounterIndicator({
  kind,
  active
}: {
  kind: 'ask' | 'work' | 'done'
  active: boolean
}): React.JSX.Element {
  if (kind === 'work' && active) {
    return (
      <AgentWorkingSpinner className="size-2.5 shrink-0 ![animation:agent-spinner-rotate_86400s_steps(1036800,end)_infinite]" />
    )
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

/**
 * One face of the dock. Both stay mounted so a hover crossfades them; the face not shown leaves
 * the layout (the bar sizes to the shown one) and goes inert.
 */
export function DockLayer({
  shown,
  spacing,
  children
}: {
  shown: boolean
  spacing: 'tight' | 'loose'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      inert={!shown}
      data-shown={shown}
      data-spacing={spacing}
      className="flex shrink-0 items-center transition-[opacity,scale] delay-75 duration-200 ease-out group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col data-[spacing=loose]:gap-2 data-[spacing=tight]:gap-0.5 data-[shown=false]:pointer-events-none data-[shown=false]:absolute data-[shown=false]:top-1/2 data-[shown=false]:left-1/2 data-[shown=false]:w-max data-[shown=false]:-translate-x-1/2 data-[shown=false]:-translate-y-1/2 data-[shown=false]:scale-90 data-[shown=false]:opacity-0 data-[shown=false]:delay-0 data-[shown=false]:duration-100"
    >
      {children}
    </div>
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

/**
 * The notch and its fillets as one shape, so its hairline runs unbroken into the bar it grows
 * from. Drawn by `paintAgentHubNotch`, not React, so it can follow the bar frame by frame.
 */
export function NotchShape({
  notchRef
}: {
  notchRef: React.Ref<SVGSVGElement>
}): React.JSX.Element {
  return (
    <svg
      ref={notchRef}
      aria-hidden
      className="pointer-events-none absolute overflow-visible group-data-[dragging=true]/dock:hidden"
    >
      <path data-notch="fill" className="fill-[var(--hub-notch)]" />
      <path
        data-notch="stroke"
        fill="none"
        className="stroke-border"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function paintAgentHubNotch(
  svg: SVGSVGElement,
  edge: AgentHubDockEdge,
  bar: { width: number; height: number }
): void {
  const shape = agentHubNotchShape(edge, bar)
  svg.style.left = `${shape.left}px`
  svg.style.top = `${shape.top}px`
  svg.style.width = `${shape.width}px`
  svg.style.height = `${shape.height}px`
  svg.setAttribute('viewBox', `0 0 ${shape.width} ${shape.height}`)
  svg.querySelector('[data-notch="fill"]')?.setAttribute('d', shape.fill)
  svg.querySelector('[data-notch="stroke"]')?.setAttribute('d', shape.stroke)
}
