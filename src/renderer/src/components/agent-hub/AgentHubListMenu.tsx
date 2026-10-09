import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** An icon button beside the Agents and All terminals search that opens a list option menu. */
export function AgentHubListMenu({
  menu,
  value,
  label,
  icon,
  title,
  active = false,
  focusable = false,
  onClosed,
  children
}: {
  menu: 'sort' | 'window-filter'
  /** The option in use, published for tests and styling as data-value. */
  value: string
  label: string
  icon: React.ReactNode
  title: string
  /** Marks the button while it narrows the list. */
  active?: boolean
  focusable?: boolean
  /** The menu closed: the caller decides where focus goes. */
  onClosed: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              tabIndex={focusable ? 0 : -1}
              aria-label={label}
              data-agent-hub-list-menu={menu}
              data-value={value}
              data-active={active}
              className="grid size-8.5 shrink-0 place-items-center rounded-lg border border-foreground/[0.08] bg-background text-muted-foreground hover:text-foreground data-[active=true]:border-foreground/20 data-[active=true]:bg-foreground/[0.07] data-[active=true]:text-foreground data-[state=open]:border-foreground/20 data-[state=open]:text-foreground"
            >
              {icon}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="w-44"
        // Why: the menu's arrows and Enter must not also drive the list behind it.
        onKeyDown={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onClosed()
        }}
      >
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
