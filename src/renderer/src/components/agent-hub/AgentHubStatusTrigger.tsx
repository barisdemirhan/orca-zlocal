import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import { HubStateIndicator } from './AgentHubAtoms'
import type { AgentHubCounts } from './agent-hub-lists'

/** The status-bar placement: the counts pill plus "N need you"; popover props pass through. */
export function AgentHubStatusTrigger({
  counts,
  label,
  open,
  iconOnly,
  ...buttonProps
}: React.ComponentProps<'button'> & {
  counts: AgentHubCounts
  label: string
  open: boolean
  iconOnly: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      {...buttonProps}
      data-open={open}
      className="flex h-[22px] cursor-pointer items-center gap-1.5 rounded-[5px] pr-2 pl-1 whitespace-nowrap text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground data-[open=true]:bg-foreground/[0.07] data-[open=true]:text-foreground"
      aria-label={label}
    >
      <span className="flex h-[18px] items-center gap-1 rounded-full border border-foreground/10 bg-background px-[7px] font-mono text-[10.5px] text-muted-foreground">
        {counts.working > 0 ? (
          <AgentWorkingSpinner className="size-[9px] border-[1.5px]" />
        ) : (
          <span className="size-2.5 rounded-full border-[1.5px] border-foreground/20" />
        )}
        <span className="mr-[3px]">{counts.working}</span>
        {counts.needsYou > 0 ? (
          <>
            <HubStateIndicator kind="ask" />
            <span className="mr-[3px] text-agent-question-text">{counts.needsYou}</span>
          </>
        ) : null}
        {counts.finished > 0 ? (
          <>
            <HubStateIndicator kind="done" />
            <span>{counts.finished}</span>
          </>
        ) : null}
      </span>
      {iconOnly ? null : (
        <span
          data-attention={counts.needsYou > 0}
          className="data-[attention=true]:text-agent-question-text"
        >
          {label}
        </span>
      )}
    </button>
  )
}
