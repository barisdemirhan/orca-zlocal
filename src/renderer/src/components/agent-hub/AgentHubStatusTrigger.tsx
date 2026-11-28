import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'
import { DockCounters } from './AgentHubDockParts'
import type { AgentHubCounts } from './agent-hub-lists'

/** The status-bar placement: the counts pill plus "N need you"; popover props pass through. */
export function AgentHubStatusTrigger({
  counts,
  label,
  open,
  orb,
  ...buttonProps
}: React.ComponentProps<'button'> & {
  counts: AgentHubCounts
  label: string
  open: boolean
  orb?: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      {orb}
      <button
        type="button"
        {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
        {...buttonProps}
        data-open={open}
        className="flex h-5.5 cursor-pointer items-center gap-1.5 rounded-sm pr-2 pl-1 whitespace-nowrap text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground data-[open=true]:bg-foreground/[0.07] data-[open=true]:text-foreground"
        aria-label={label}
      >
        <span className="flex h-4.5 items-center gap-2 rounded-full border border-foreground/10 bg-background px-2">
          <DockCounters counts={counts} />
        </span>
        <span
          data-attention={counts.needsYou > 0}
          className="data-[attention=true]:text-agent-question-text"
        >
          {label}
        </span>
      </button>
    </>
  )
}
