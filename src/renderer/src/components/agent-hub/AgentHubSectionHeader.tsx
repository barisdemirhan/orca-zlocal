import { translate } from '@/i18n/i18n'

export function HubSection({
  label,
  count,
  nested,
  tone = 'neutral',
  action
}: {
  label: string
  count?: number
  /** Workers under the counted agents, shown as "+N". */
  nested?: number
  tone?: 'neutral' | 'ask' | 'done'
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-2 pt-3 pb-2">
      <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground/70 uppercase">
        {label}
      </span>
      {count !== undefined ? (
        <span
          data-tone={tone}
          className="font-mono text-[11px] text-muted-foreground data-[tone=ask]:text-agent-question data-[tone=done]:text-status-success"
        >
          {count}
          <HubNestedCount value={nested} />
        </span>
      ) : null}
      {action ? <span className="ml-auto flex items-center gap-0.5">{action}</span> : null}
    </div>
  )
}

/** "+8": workers running under the agents counted beside it. */
export function HubNestedCount({ value }: { value: number | undefined }): React.JSX.Element | null {
  if (!value) {
    return null
  }
  return (
    <span
      title={translate('agentHub.count.nested', '{{value0}} more under them', { value0: value })}
      className="ml-0.5 font-mono text-[0.85em] text-muted-foreground/60"
    >
      +{value}
    </span>
  )
}
