import { AgentHubShortcut } from './AgentHubShortcut'
import { AgentWorkingSpinner } from '@/components/agent/status/AgentWorkingSpinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentHubDockEdge } from '../../../../shared/agent-hub-settings'
import { HubNestedCount } from './AgentHubSectionHeader'
import { agentHubNotchShape } from './agent-hub-dock-geometry'
import type { AgentHubCounts } from './agent-hub-lists'

export const DOCK_BUTTON =
  'relative grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-foreground/[0.07] aria-pressed:text-foreground'
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
  value,
  nested
}: {
  kind: 'ask' | 'work' | 'done'
  value: number
  /** Workers running under the counted agents, as "+N". */
  nested?: number
}): React.JSX.Element {
  return (
    <span
      data-zero={value === 0}
      className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground tabular-nums data-[zero=true]:opacity-45 group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col"
    >
      <CounterIndicator kind={kind} active={value > 0} />
      <span>
        {value}
        <HubNestedCount value={nested} />
      </span>
    </span>
  )
}

/** The three counts as bare glyphs, for the status-bar trigger. */
export function DockCounters({ counts }: { counts: AgentHubCounts }): React.JSX.Element {
  return (
    <>
      <DockCounter kind="work" value={counts.working} nested={counts.nestedWorking} />
      <DockCounter kind="ask" value={counts.needsYou} />
      <DockCounter kind="done" value={counts.finished} />
    </>
  )
}

/** The three counts; each opens its tab. */
export function DockCounterGroup({
  counts,
  side,
  onOpenTab
}: {
  counts: AgentHubCounts
  side: 'top' | 'bottom' | 'left' | 'right'
  onOpenTab: (tab: 'running' | 'inbox') => void
}): React.JSX.Element {
  const items = [
    {
      kind: 'work',
      value: counts.working,
      nested: counts.nestedWorking,
      tab: 'running',
      label: translate('agentHub.tab.running', 'Running')
    },
    {
      kind: 'ask',
      value: counts.needsYou,
      nested: 0,
      tab: 'inbox',
      label: translate('agentHub.dock.waiting', 'Waiting on you')
    },
    {
      kind: 'done',
      value: counts.finished,
      nested: 0,
      tab: 'inbox',
      label: translate('agentHub.dock.finished', 'Finished')
    }
  ] as const
  return (
    <span className="flex shrink-0 items-center group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col">
      {items.map((item) => (
        <DockButton
          key={item.kind}
          label={item.label}
          side={side}
          className={DOCK_COUNT_BUTTON}
          onClick={() => onOpenTab(item.tab)}
        >
          <DockCounter kind={item.kind} value={item.value} nested={item.nested} />
        </DockButton>
      ))}
    </span>
  )
}

/**
 * The buttons the dock shows only unfolded. Folded, they leave the layout (the bar sizes to what
 * comes before them) but keep the spot they have unfolded, right after their siblings, so the
 * growing bar uncovers them in place while they fade in.
 */
export function DockExtras({
  shown,
  children
}: {
  shown: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      data-shown={shown}
      className="flex shrink-0 items-center gap-0.5 transition-opacity duration-200 ease-out group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col data-[shown=false]:absolute data-[shown=false]:top-0 data-[shown=false]:left-full data-[shown=false]:ml-0.5 data-[shown=false]:opacity-0 group-data-[edge=left]/dock:data-[shown=false]:top-full group-data-[edge=left]/dock:data-[shown=false]:left-0 group-data-[edge=left]/dock:data-[shown=false]:mt-0.5 group-data-[edge=left]/dock:data-[shown=false]:ml-0 group-data-[edge=right]/dock:data-[shown=false]:top-full group-data-[edge=right]/dock:data-[shown=false]:left-0 group-data-[edge=right]/dock:data-[shown=false]:mt-0.5 group-data-[edge=right]/dock:data-[shown=false]:ml-0"
    >
      {children}
    </div>
  )
}

export function DockButton({
  label,
  hint,
  actionId,
  side,
  className,
  disabled,
  pressed,
  preserveFocus = false,
  onClick,
  children
}: {
  label: string
  hint?: React.ReactNode
  actionId?: string
  side: 'top' | 'bottom' | 'left' | 'right'
  className: string
  disabled?: boolean
  /** For a button that switches something on and off. */
  pressed?: boolean
  preserveFocus?: boolean
  onClick: React.MouseEventHandler<HTMLButtonElement>
  children: React.ReactNode
}): React.JSX.Element {
  const button = (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      onMouseDown={preserveFocus ? (event) => event.preventDefault() : undefined}
      className={className}
    >
      {children}
    </button>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? (
          <span data-agent-hub-dock-button className="inline-flex">
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8}>
        <span className="flex items-center gap-2">
          {hint ?? label}
          <AgentHubShortcut actionId={actionId} />
        </span>
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
