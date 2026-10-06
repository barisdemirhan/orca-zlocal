import { useAppStore } from '@/store'
import { formatShortcutKeyComboDetails } from '@/hooks/useShortcutLabel'
import { isKeybindingActionId } from '../../../../shared/keybindings'
import { ShortcutKeyCombo } from '../ShortcutKeyCombo'
import { ContextMenuShortcut } from '../ui/context-menu'
import { DropdownMenuShortcut } from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

/** Unknown sibling-branch actions deliberately have no hint. */
export function AgentHubShortcut({
  actionId,
  slot
}: {
  actionId?: string
  slot?: 'context' | 'dropdown'
}): React.JSX.Element | null {
  const bindings = useAppStore((s) => s.keybindings)
  const details =
    actionId && isKeybindingActionId(actionId)
      ? formatShortcutKeyComboDetails(actionId, bindings)
      : []
  if (details.length === 0) {
    return null
  }
  const combos = (
    <span className="inline-flex flex-wrap items-center gap-1">
      {details.map((detail, index) => (
        <ShortcutKeyCombo key={index} {...detail} />
      ))}
    </span>
  )
  if (slot === 'context') {
    return <ContextMenuShortcut>{combos}</ContextMenuShortcut>
  }
  if (slot === 'dropdown') {
    return <DropdownMenuShortcut>{combos}</DropdownMenuShortcut>
  }
  return combos
}

export function AgentHubActionTooltip({
  label,
  actionId,
  children
}: {
  label: string
  actionId?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <span className="flex items-center gap-2">
          {label}
          <AgentHubShortcut actionId={actionId} />
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
