import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubStateIndicator } from './AgentHubAtoms'
import { agentHubIndicatorKind } from './agent-hub-lists'

/**
 * The agent and the workers it dispatched, as tabs under a mirror's header: switching one shows
 * that terminal in the same window, and the first tab always leads back to the dispatcher.
 */
export function AgentHubMirrorFamilyTabs({
  members,
  activeKey,
  onSelect
}: {
  /** The dispatcher first, then its workers. */
  members: readonly AgentPaneThread[]
  activeKey: string
  onSelect: (thread: AgentPaneThread) => void
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-popover/70 px-2 py-1 scrollbar-sleek"
    >
      {members.map((thread, index) => (
        <button
          key={thread.paneKey}
          type="button"
          role="tab"
          aria-selected={thread.paneKey === activeKey}
          data-active={thread.paneKey === activeKey}
          data-dispatcher={index === 0}
          onClick={() => onSelect(thread)}
          className="flex h-6 max-w-[200px] shrink-0 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground data-[active=true]:bg-foreground/[0.1] data-[active=true]:text-foreground data-[dispatcher=true]:font-semibold"
        >
          <HubStateIndicator kind={agentHubIndicatorKind(thread)} />
          <span className="truncate">{activityThreadRowCopy(thread).taskTitle}</span>
        </button>
      ))}
    </div>
  )
}
