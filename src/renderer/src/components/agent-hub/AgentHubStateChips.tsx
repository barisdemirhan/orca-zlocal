import { translate } from '@/i18n/i18n'
import {
  AGENT_HUB_STATE_FILTERS,
  type AgentHubStateCounts,
  type AgentHubStateFilter
} from './agent-hub-state-filter'

function chipLabel(filter: AgentHubStateFilter): string {
  switch (filter) {
    case 'ask':
      return translate('agentHub.stateChips.ask', 'Needs you')
    case 'work':
      return translate('agentHub.stateChips.work', 'Working')
    case 'done':
      return translate('agentHub.stateChips.done', 'Done')
    case 'idle':
      return translate('agentHub.stateChips.idle', 'Idle')
    case 'sleep':
      return translate('agentHub.stateChips.sleep', 'Sleeping')
    default:
      return translate('agentHub.stateChips.all', 'All')
  }
}

export function AgentHubStateChips({
  value,
  counts,
  onChange
}: {
  value: AgentHubStateFilter
  counts: AgentHubStateCounts
  onChange: (filter: AgentHubStateFilter) => void
}): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={translate('agentHub.stateChips.label', 'Filter by state')}
      className="flex flex-wrap gap-1 pb-1"
    >
      {AGENT_HUB_STATE_FILTERS.map((filter) => {
        const count = filter === 'all' ? 0 : counts[filter]
        return (
          <button
            key={filter}
            type="button"
            tabIndex={-1}
            aria-pressed={value === filter}
            onClick={() => onChange(filter)}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground aria-pressed:border-foreground/30 aria-pressed:bg-accent aria-pressed:text-foreground"
          >
            {chipLabel(filter)}
            {count ? <span className="ml-1 font-mono">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
