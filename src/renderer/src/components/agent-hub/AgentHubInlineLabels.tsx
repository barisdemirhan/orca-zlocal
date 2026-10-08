import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { WorktreeHostContextBadge } from '@/components/sidebar/WorktreeHostContextBadge'
import type { AgentHubLocation } from './agent-hub-pane-target'

export function HubChip({
  tone = 'neutral',
  children
}: {
  tone?: 'neutral' | 'ask'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      data-tone={tone}
      className="rounded-sm border border-border bg-foreground/[0.05] px-1.5 py-px font-mono text-[11px] whitespace-nowrap text-muted-foreground data-[tone=ask]:border-agent-question/25 data-[tone=ask]:bg-agent-question/12 data-[tone=ask]:text-agent-question-text"
    >
      {children}
    </span>
  )
}

/** Compact key chips sized for the hub's dense rows; same platform-label rules as everywhere. */
export function HubKeys({ keys }: { keys: string[] }): React.JSX.Element {
  return (
    <ShortcutKeyCombo
      keys={keys}
      className="gap-0.5"
      separatorClassName="text-[11px] text-muted-foreground"
      keyCapClassName="min-w-0 rounded-sm border-border bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium shadow-none"
    />
  )
}

/** "Group › project · workspace", with the mock's dim separators. */
export function HubCrumb({ location }: { location: AgentHubLocation }): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center text-xs leading-4 text-muted-foreground">
      <span className="truncate">
        {location.group ? (
          <>
            {location.group}
            <span className="mx-1 text-muted-foreground/60">›</span>
          </>
        ) : null}
        {location.project}
        {location.workspace ? (
          <>
            <span className="mx-1 text-muted-foreground/60">·</span>
            {location.workspace}
          </>
        ) : null}
      </span>
      {location.host ? <WorktreeHostContextBadge label={location.host} className="ml-1.5" /> : null}
    </span>
  )
}
