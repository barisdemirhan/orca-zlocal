import type React from 'react'
import { Ellipsis } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MenuItemBlockedReason } from '@/components/ui/menu-item-blocked-reason'
import { translate } from '@/i18n/i18n'

export type BotsMenuEntry =
  | 'separator'
  | {
      key: string
      label: string
      icon?: React.ReactNode
      shortcut?: string
      danger?: boolean
      /** Why the item is off; it shows as the item's tooltip. */
      blocked?: string | null
      onSelect: () => void
    }

type MenuKind = 'context' | 'dropdown'

function separatorOwner(entries: readonly BotsMenuEntry[], index: number): string {
  const previous = entries[index - 1]
  return typeof previous === 'object' ? previous.key : 'start'
}

function Entries({
  entries,
  kind
}: {
  entries: readonly BotsMenuEntry[]
  kind: MenuKind
}): React.JSX.Element {
  const Item = kind === 'context' ? ContextMenuItem : DropdownMenuItem
  const Separator = kind === 'context' ? ContextMenuSeparator : DropdownMenuSeparator
  const Shortcut = kind === 'context' ? ContextMenuShortcut : DropdownMenuShortcut
  return (
    <>
      {entries.map((entry, index) =>
        entry === 'separator' ? (
          <Separator key={`after-${separatorOwner(entries, index)}`} />
        ) : (
          <MenuItemBlockedReason
            key={entry.key}
            reason={entry.blocked ?? null}
            label={entry.label}
            side={kind === 'context' ? 'right' : 'left'}
            render={(blocked) => (
              <Item
                variant={entry.danger ? 'destructive' : undefined}
                {...blocked}
                onSelect={entry.blocked ? undefined : entry.onSelect}
              >
                {entry.icon}
                {entry.label}
                {entry.shortcut ? <Shortcut>{entry.shortcut}</Shortcut> : null}
              </Item>
            )}
          />
        )
      )}
    </>
  )
}

/** Right-click on a row opens the entries. */
export function BotsContextMenu({
  entries,
  children
}: {
  entries: readonly BotsMenuEntry[]
  children: React.ReactElement
}): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <Entries entries={entries} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** The row's ⋯ with the same entries as its right-click. */
export function BotsMoreMenu({
  entries
}: {
  entries: readonly BotsMenuEntry[]
}): React.JSX.Element {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label={translate('agentHub.bots.tab.more', 'More')}
          onMouseDown={(event) => event.preventDefault()}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground data-[state=open]:bg-foreground/[0.07]"
        >
          <Ellipsis className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <Entries entries={entries} kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
