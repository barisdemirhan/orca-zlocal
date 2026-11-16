import { useAppStore } from '@/store'
import { formatShortcutKeyComboDetails } from '@/hooks/useShortcutLabel'
import { isKeybindingActionId } from '../../../../shared/keybindings/definitions'
import { ShortcutKeyCombo } from '../ShortcutKeyCombo'
import { ContextMenuShortcut } from '../ui/context-menu'
import { DropdownMenuShortcut } from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

/** Unknown sibling-branch actions deliberately have no hint. */
export function AgentHubShortcut({
  actionId,
  slot,
  keyCapClassName
}: {
  actionId?: string
  slot?: 'context' | 'dropdown'
  keyCapClassName?: string
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
      {details.map((detail) => (
        <ShortcutKeyCombo
          key={`${detail.doubleTap}:${detail.keys.join('+')}`}
          keyCapClassName={keyCapClassName}
          {...detail}
        />
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

// Why: the tooltip surface is inverted, so default keycaps are unreadable on it.
const TOOLTIP_KEYCAP_CLASS =
  'min-w-0 border-background/20 bg-background/10 px-1 py-0 text-[10px] text-background shadow-none'

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
          <AgentHubShortcut actionId={actionId} keyCapClassName={TOOLTIP_KEYCAP_CLASS} />
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
