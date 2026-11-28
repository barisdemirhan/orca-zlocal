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
import type { AgentHubInboxMenuItem } from './agent-hub-inbox-menus'

/** Right click opens the items under the pointer. */
export function AgentHubInboxContextMenu({
  items,
  children
}: {
  items: readonly AgentHubInboxMenuItem[]
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((item) => (
          <div key={item.id}>
            {item.separatorBefore ? <ContextMenuSeparator /> : null}
            <ContextMenuItem onSelect={item.onSelect}>
              {item.label}
              {item.keys ? <ContextMenuShortcut>{item.keys}</ContextMenuShortcut> : null}
            </ContextMenuItem>
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** The "⋯" button that appears on hover. */
export function AgentHubInboxMoreMenu({
  items,
  label,
  children
}: {
  items: readonly AgentHubInboxMenuItem[]
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label={label}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <div key={item.id}>
            {item.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={item.onSelect}>
              {item.label}
              {item.keys ? <DropdownMenuShortcut>{item.keys}</DropdownMenuShortcut> : null}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
