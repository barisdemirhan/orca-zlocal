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
import { translate } from '@/i18n/i18n'
import type { AgentHubPickerProject } from './agent-hub-picker-project-filter'

/** The picker's project chips: which projects narrow the list, and a multi-select to change them. */
export function AgentHubPickerProjectFilter({
  projects,
  selected,
  onChange,
  onClosed
}: {
  projects: readonly AgentHubPickerProject[]
  selected: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
  onClosed: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = projects.filter((project) => selected.has(project.key))
  const words = query.trim().toLowerCase()
  const listed = words
    ? projects.filter((project) =>
        `${project.label} ${project.hostLabel ?? ''}`.toLowerCase().includes(words)
      )
    : projects
  const toggle = (key: string): void => {
    const next = new Set(selected)
    if (!next.delete(key)) {
      next.add(key)
    }
    onChange(next)
  }
  return (
    <div data-agent-hub-project-filter className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-0.5 text-muted-foreground">
        {translate('agentHub.mirror.projectFilter.label', 'Projects')}
      </span>
      {chosen.map((project) => (
        <span
          key={project.key}
          data-agent-hub-project-chip
          className="inline-flex h-6 max-w-[200px] items-center gap-1 rounded-md border border-border bg-foreground/[0.05] pr-0.5 pl-2 text-foreground"
        >
          <span className="truncate">{project.label}</span>
          {project.hostLabel ? (
            <span className="shrink-0 text-muted-foreground">· {project.hostLabel}</span>
          ) : null}
          <button
            type="button"
            aria-label={translate(
              'agentHub.mirror.projectFilter.remove',
              'Remove {{value0}} from the filter',
              { value0: project.label }
            )}
            onClick={() => toggle(project.key)}
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
            {chosen.length > 0
              ? translate('agentHub.mirror.projectFilter.add', 'Project')
              : translate('agentHub.mirror.projectFilter.all', 'All projects')}
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
              placeholder={translate('agentHub.mirror.projectFilter.search', 'Search projects…')}
              className="text-xs"
            />
            <CommandList>
              <CommandEmpty>
                {translate('agentHub.mirror.projectFilter.noMatch', 'No projects match.')}
              </CommandEmpty>
              {listed.map((project) => (
                <CommandItem
                  key={project.key}
                  value={project.key}
                  onSelect={() => toggle(project.key)}
                  className="items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <Check
                    data-selected={selected.has(project.key)}
                    className="size-3 text-muted-foreground opacity-0 data-[selected=true]:opacity-70"
                  />
                  <span className="min-w-0 flex-1 truncate">{project.label}</span>
                  {project.hostLabel ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {project.hostLabel}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {chosen.length > 0 ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => onChange(new Set())}>
          {translate('agentHub.mirror.projectFilter.clear', 'Clear filter')}
        </Button>
      ) : null}
    </div>
  )
}
