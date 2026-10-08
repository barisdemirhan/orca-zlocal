import type { ReactNode } from 'react'

export type AgentHubTabSwitcherProps<T extends string> = {
  tabs: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  counts?: Partial<Record<T, ReactNode>>
  // Why: the tab whose count flags something waiting on the user.
  askValue?: T
  ariaLabel?: string
  // Why: set only where the tabs take keyboard focus themselves (picker); the hub panel root owns its keys.
  focusIdPrefix?: string
}

export function agentHubTabSwitcherPanelProps(
  idPrefix: string,
  value: string
): { id: string; role: 'tabpanel'; 'aria-labelledby': string } {
  return {
    id: `${idPrefix}-panel`,
    role: 'tabpanel',
    'aria-labelledby': `${idPrefix}-tab-${value}`
  }
}

export function AgentHubTabSwitcher<T extends string>({
  tabs,
  value,
  onChange,
  counts,
  askValue,
  ariaLabel,
  focusIdPrefix
}: AgentHubTabSwitcherProps<T>): React.JSX.Element {
  const focusable = focusIdPrefix !== undefined
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (!focusable || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) {
          return
        }
        const index = tabs.findIndex((tab) => tab.value === value)
        const step = event.key === 'ArrowRight' ? 1 : -1
        const next = tabs[(index + step + tabs.length) % tabs.length]
        if (!next) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        onChange(next.value)
        document.getElementById(`${focusIdPrefix}-tab-${next.value}`)?.focus()
      }}
      // Why min-w-0 and hidden overflow: in a window narrower than the panel the tabs clip
      // rather than wrap or push the close button out.
      className="ml-auto flex min-w-0 gap-0.5 overflow-hidden rounded-lg border border-border bg-background p-0.5"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          id={focusable ? `${focusIdPrefix}-tab-${tab.value}` : undefined}
          type="button"
          role="tab"
          tabIndex={focusable && value === tab.value ? 0 : -1}
          aria-selected={value === tab.value}
          aria-controls={focusable ? `${focusIdPrefix}-panel` : undefined}
          data-active={value === tab.value}
          onClick={() => onChange(tab.value)}
          className="group/tab flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground"
        >
          {tab.label}
          {counts?.[tab.value] !== undefined ? (
            <span
              data-ask={tab.value === askValue}
              className="font-mono text-[11px] text-muted-foreground/70 group-data-[active=true]/tab:text-muted-foreground data-[ask=true]:text-agent-question group-data-[active=true]/tab:data-[ask=true]:text-agent-question"
            >
              {counts[tab.value]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
