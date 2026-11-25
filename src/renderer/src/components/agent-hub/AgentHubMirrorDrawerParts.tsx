import { cn } from '@/lib/class-names'

export function DrawerSection({
  label,
  count,
  action
}: {
  label: string
  count?: number
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      <span>{label}</span>
      {count !== undefined ? <span className="font-mono normal-case">{count}</span> : null}
      <span className="ml-auto normal-case">{action}</span>
    </div>
  )
}

export function DrawerRow({
  lead,
  children,
  trail,
  title
}: {
  lead?: React.ReactNode
  children: React.ReactNode
  trail?: React.ReactNode
  title?: string
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
      {lead}
      <span className="min-w-0 flex-1 truncate" title={title}>
        {children}
      </span>
      {trail ? <span className="flex shrink-0 items-center gap-2">{trail}</span> : null}
    </div>
  )
}

export function DrawerLink({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
        'disabled:pointer-events-none disabled:opacity-40'
      )}
    >
      {children}
    </button>
  )
}

export function DrawerNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="p-3 text-[13px] text-muted-foreground">{children}</p>
}

export function formatDrawerElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
