import { Activity, ArrowDownAZ, Clock, FolderTree, GripVertical } from 'lucide-react'
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { SORT_OPTIONS } from '../sidebar/worktree-list/controls/sidebar-workspace-option-items'
import { AgentHubListMenu } from './AgentHubListMenu'

function SortIcon({ sortBy }: { sortBy: AgentHubTerminalSort }): React.JSX.Element {
  switch (sortBy) {
    case 'name':
      return <ArrowDownAZ className="size-3.5" />
    case 'smart':
      return <Activity className="size-3.5" />
    case 'recent':
      return <Clock className="size-3.5" />
    case 'repo':
      return <FolderTree className="size-3.5" />
    case 'manual':
      return <GripVertical className="size-3.5" />
  }
}

// The sidebar's own hint for Manual is about dragging, which the hub does not offer.
function sortHint(option: (typeof SORT_OPTIONS)[number]): string | null {
  if (option.id === 'manual') {
    return translate(
      'agentHub.terminals.sortManualHint',
      'Workspaces in the order you arranged them in the sidebar.'
    )
  }
  return option.description
}

/**
 * The sort of the Agents and All terminals lists: the sidebar's choices under the sidebar's
 * names. The button shows the order in use.
 */
export function AgentHubTerminalSortMenu({
  sortBy,
  onSortChange,
  onClosed,
  focusable = false
}: {
  sortBy: AgentHubTerminalSort
  onSortChange: (sortBy: AgentHubTerminalSort) => void
  /** The menu closed: the caller decides where focus goes. */
  onClosed: () => void
  focusable?: boolean
}): React.JSX.Element {
  const current = SORT_OPTIONS.find((option) => option.id === sortBy)?.label ?? ''
  const label = translate('agentHub.terminals.sortLabel', 'Sort: {{value0}}', {
    value0: current
  })
  return (
    <AgentHubListMenu
      menu="sort"
      value={sortBy}
      label={label}
      icon={<SortIcon sortBy={sortBy} />}
      title={translate('agentHub.terminals.sortBy', 'Sort by')}
      focusable={focusable}
      onClosed={onClosed}
    >
      <DropdownMenuRadioGroup
        value={sortBy}
        onValueChange={(value) => {
          const next = SORT_OPTIONS.find((option) => option.id === value)?.id
          if (next) {
            onSortChange(next)
          }
        }}
      >
        {SORT_OPTIONS.map((option) => {
          const hint = sortHint(option)
          const item = (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <SortIcon sortBy={option.id} />
              {option.label}
            </DropdownMenuRadioItem>
          )
          return hint ? (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>{item}</TooltipTrigger>
              <TooltipContent side="left" sideOffset={6}>
                {hint}
              </TooltipContent>
            </Tooltip>
          ) : (
            item
          )
        })}
      </DropdownMenuRadioGroup>
    </AgentHubListMenu>
  )
}
