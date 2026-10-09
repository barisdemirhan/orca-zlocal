import { ListFilter } from 'lucide-react'
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { AgentHubListMenu } from './AgentHubListMenu'
import {
  AGENT_HUB_WINDOW_FILTERS,
  agentHubWindowFilterOption,
  type AgentHubWindowFilter
} from './agent-hub-window-filter'

/** Narrows the list to terminals open in a window, minimized to a chip, or in neither. */
export function AgentHubWindowFilterMenu({
  filter,
  onFilterChange,
  onClosed
}: {
  filter: AgentHubWindowFilter
  onFilterChange: (filter: AgentHubWindowFilter) => void
  onClosed: () => void
}): React.JSX.Element {
  return (
    <AgentHubListMenu
      menu="window-filter"
      value={filter}
      active={filter !== 'any'}
      label={
        filter === 'any'
          ? translate('agentHub.windowFilter.label', 'Filter by window')
          : translate('agentHub.windowFilter.labelActive', 'Filter: {{value0}}', {
              value0: agentHubWindowFilterOption(filter).label()
            })
      }
      icon={<ListFilter className="size-3.5" />}
      title={translate('agentHub.windowFilter.title', 'Show')}
      onClosed={onClosed}
    >
      <DropdownMenuRadioGroup
        value={filter}
        onValueChange={(value) => {
          const next = AGENT_HUB_WINDOW_FILTERS.find((option) => option.id === value)
          if (next) {
            onFilterChange(next.id)
          }
        }}
      >
        {AGENT_HUB_WINDOW_FILTERS.map((option) => (
          <DropdownMenuRadioItem key={option.id} value={option.id}>
            {option.label()}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </AgentHubListMenu>
  )
}
