import { WorktreeHostContextBadge } from '@/components/sidebar/workspace-card/host/WorktreeHostContextBadge'
import type { AgentHubGroupNode } from './agent-hub-terminal-tree'

export function WorkspaceHostBadge({
  label
}: {
  label: string | undefined
}): React.JSX.Element | null {
  return label ? <WorktreeHostContextBadge label={label} /> : null
}

export function GroupSummary({ group }: { group: AgentHubGroupNode }): React.JSX.Element {
  return (
    <span className="ml-auto flex items-center gap-2 font-mono text-[11px] font-normal text-muted-foreground">
      {group.counts.needsYou > 0 ? (
        <span className="text-agent-question-text">{group.counts.needsYou}</span>
      ) : null}
      <span>{group.rowCount}</span>
    </span>
  )
}
