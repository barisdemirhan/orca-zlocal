import { ListFilter } from 'lucide-react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { AgentHubListMenu } from './AgentHubListMenu'
import {
  AGENT_HUB_WINDOW_FILTERS,
  agentHubWindowFilterOption,
  type AgentHubWindowFilter
} from './agent-hub-window-filter'
import type { AgentHubHostFilter } from './use-agent-hub-host-filter'

const ALL_HOSTS = '\u0000all-hosts'

export type AgentHubRowToggles = {
  unreadOnly: boolean
  botStartedOnly: boolean
  /** Offered only while bots are on. */
  botsAvailable: boolean
  onChange: (patch: { unreadOnly?: boolean; botStartedOnly?: boolean }) => void
}

/**
 * Narrows the list to terminals open in a window, minimized to a chip, or in neither, and to
 * one host when the terminals span several.
 */
export function AgentHubWindowFilterMenu({
  filter,
  onFilterChange,
  host,
  toggles,
  onClosed
}: {
  filter: AgentHubWindowFilter
  onFilterChange: (filter: AgentHubWindowFilter) => void
  host?: Pick<AgentHubHostFilter, 'value' | 'options' | 'onChange'>
  toggles?: AgentHubRowToggles
  onClosed: () => void
}): React.JSX.Element {
  const hostLabel = host?.options.find((option) => option.id === host.value)?.label
  const parts = [
    ...(filter === 'any' ? [] : [agentHubWindowFilterOption(filter).label()]),
    ...(toggles?.unreadOnly ? [translate('agentHub.filter.unreadOnly', 'Unread only')] : []),
    ...(toggles?.botStartedOnly
      ? [translate('agentHub.filter.botStarted', 'Started by a bot')]
      : []),
    ...(hostLabel ? [hostLabel] : [])
  ]
  return (
    <AgentHubListMenu
      menu="window-filter"
      value={filter}
      active={parts.length > 0}
      label={
        parts.length === 0
          ? translate('agentHub.windowFilter.label', 'Filter by window')
          : translate('agentHub.windowFilter.labelActive', 'Filter: {{value0}}', {
              value0: parts.join(' · ')
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
      {toggles ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={toggles.unreadOnly}
            onCheckedChange={(checked) => toggles.onChange({ unreadOnly: checked === true })}
          >
            {translate('agentHub.filter.unreadOnly', 'Unread only')}
          </DropdownMenuCheckboxItem>
          {toggles.botsAvailable ? (
            <DropdownMenuCheckboxItem
              checked={toggles.botStartedOnly}
              onCheckedChange={(checked) => toggles.onChange({ botStartedOnly: checked === true })}
            >
              {translate('agentHub.filter.botStarted', 'Started by a bot')}
            </DropdownMenuCheckboxItem>
          ) : null}
        </>
      ) : null}
      {host && host.options.length > 0 ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{translate('agentHub.hostFilter.title', 'Host')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={host.value ?? ALL_HOSTS}
            onValueChange={(value) => host.onChange(value === ALL_HOSTS ? null : value)}
          >
            <DropdownMenuRadioItem value={ALL_HOSTS}>
              {translate('agentHub.hostFilter.any', 'All hosts')}
            </DropdownMenuRadioItem>
            {host.options.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={option.id}>
                <span className="truncate">{option.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </>
      ) : null}
    </AgentHubListMenu>
  )
}
