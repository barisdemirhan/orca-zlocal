import { useState } from 'react'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type AgentHubPickerFilterItem = {
  key: string
  label: string
  secondaryLabel?: string | null
  leading?: React.ReactNode
  count?: number
}

export type AgentHubPickerFilterStrings = {
  label: string
  add: string
  all: string
  search: string
  noMatch: string
  remove: (label: string) => string
}

/** One picker filter: chips for the chosen items, and a searchable multi-select to change them. */
export function AgentHubPickerChipFilter({
  id,
  items,
  selected,
  strings,
  onChange,
  onClosed
}: {
  id: string
  items: readonly AgentHubPickerFilterItem[]
  selected: ReadonlySet<string>
  strings: AgentHubPickerFilterStrings
  onChange: (next: ReadonlySet<string>) => void
  onClosed: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = items.filter((item) => selected.has(item.key))
  const words = query.trim().toLowerCase()
  const listed = words
    ? items.filter((item) =>
        `${item.label} ${item.secondaryLabel ?? ''}`.toLowerCase().includes(words)
      )
    : items
  const toggle = (key: string): void => {
    const next = new Set(selected)
    if (!next.delete(key)) {
      next.add(key)
    }
    onChange(next)
  }
  return (
    <div data-agent-hub-filter={id} className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-muted-foreground">{strings.label}</span>
      {chosen.map((item) => (
        <span
          key={item.key}
          data-agent-hub-filter-chip
          className="inline-flex h-6 max-w-[200px] items-center gap-1 rounded-md border border-border bg-foreground/[0.05] pr-0.5 pl-2 text-foreground"
        >
          {item.leading}
          <span className="truncate">{item.label}</span>
          {item.secondaryLabel ? (
            <span className="shrink-0 text-muted-foreground">· {item.secondaryLabel}</span>
          ) : null}
          <button
            type="button"
            aria-label={strings.remove(item.label)}
            onClick={() => toggle(item.key)}
            className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setQuery('')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="xs" aria-expanded={open}>
            <Plus />
            {chosen.length > 0 ? strings.add : strings.all}
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(280px,calc(100vw-1rem))] p-0"
          // The picker reads arrows and Esc for its own list; this menu owns them while open.
          onKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            onClosed()
          }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={strings.search}
              className="text-xs"
            />
            <CommandList>
              <CommandEmpty>{strings.noMatch}</CommandEmpty>
              {listed.map((item) => (
                <CommandItem
                  key={item.key}
                  value={item.key}
                  onSelect={() => toggle(item.key)}
                  className="items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <Check
                    data-selected={selected.has(item.key)}
                    className="size-3 text-muted-foreground opacity-0 data-[selected=true]:opacity-70"
                  />
                  {item.leading}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.secondaryLabel ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {item.secondaryLabel}
                    </span>
                  ) : null}
                  {item.count !== undefined ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {item.count}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
