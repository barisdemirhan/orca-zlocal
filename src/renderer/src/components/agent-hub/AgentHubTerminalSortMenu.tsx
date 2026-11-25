import {
  Activity,
  ArrowDownAZ,
  ArrowDownUp,
  Clock,
  FolderTree,
  GripVertical,
  Server
} from 'lucide-react'
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { SORT_OPTIONS } from '../sidebar/worktree-list/controls/sidebar-workspace-option-items'
import { AgentHubListMenu } from './AgentHubListMenu'

const HOST_SORT = 'host'

function SortIcon({ sortBy }: { sortBy: AgentHubTerminalSort | 'host' }): React.JSX.Element {
  switch (sortBy) {
    case HOST_SORT:
      return <Server className="size-3.5" />
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
  focusable = false,
  byHost
}: {
  sortBy: AgentHubTerminalSort
  onSortChange: (sortBy: AgentHubTerminalSort) => void
  /** The hub's own Host sort; absent hides the option (the picker has none). */
  byHost?: { value: boolean; onChange: (value: boolean) => void }
  /** The menu closed: the caller decides where focus goes. */
  onClosed: () => void
  focusable?: boolean
}): React.JSX.Element {
  const shown = byHost?.value ? HOST_SORT : sortBy
  const current =
    shown === HOST_SORT
      ? translate('agentHub.terminals.sortHost', 'Host')
      : (SORT_OPTIONS.find((option) => option.id === sortBy)?.label ?? '')
  const label = translate('agentHub.terminals.sortLabel', 'Sort: {{value0}}', {
    value0: current
  })
  return (
    <AgentHubListMenu
      menu="sort"
      value={shown}
      label={label}
      icon={<ArrowDownUp className="size-3.5" />}
      title={translate('agentHub.terminals.sortBy', 'Sort by')}
      focusable={focusable}
      onClosed={onClosed}
    >
      <DropdownMenuRadioGroup
        value={shown}
        onValueChange={(value) => {
          if (value === HOST_SORT) {
            byHost?.onChange(true)
            return
          }
          byHost?.onChange(false)
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
        {byHost ? (
          <DropdownMenuRadioItem value={HOST_SORT}>
            <SortIcon sortBy={HOST_SORT} />
            {translate('agentHub.terminals.sortHost', 'Host')}
          </DropdownMenuRadioItem>
        ) : null}
      </DropdownMenuRadioGroup>
    </AgentHubListMenu>
  )
}
