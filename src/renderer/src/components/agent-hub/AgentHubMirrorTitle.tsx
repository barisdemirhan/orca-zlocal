import { useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/** The tab's own name when the user gave it one, else the title the hub derived. */
export function useAgentHubTargetTitle(target: AgentHubPaneTarget): string {
  const customTitle = useAppStore(
    (s) =>
      (s.tabsByWorktree[target.worktree.id] ?? []).find((tab) => tab.id === target.tab.id)
        ?.customTitle ?? null
  )
  return customTitle?.trim() || target.title
}

/** A mirror's title: double-click renames the terminal tab, like its tab in the workspace. */
export function AgentHubMirrorTitle({ target }: { target: AgentHubPaneTarget }): React.JSX.Element {
  const title = useAgentHubTargetTitle(target)
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <div
        className="truncate font-semibold"
        title={translate('agentHub.mirror.renameHint', 'Double-click to rename')}
        onDoubleClick={() => setEditing(true)}
      >
        {title}
      </div>
    )
  }
  const commit = (value: string): void => {
    setEditing(false)
    const next = value.trim()
    // Clearing the name, or typing the derived one back, returns the tab to its automatic title.
    setTabCustomTitle(target.tab.id, next && next !== target.title ? next : null)
  }
  return (
    <input
      autoFocus
      defaultValue={title}
      aria-label={translate('agentHub.mirror.rename', 'Rename terminal')}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        // Why stop: Esc and Enter here belong to the field, not to the window or the terminal.
        event.stopPropagation()
        if (event.key === 'Enter') {
          commit(event.currentTarget.value)
        } else if (event.key === 'Escape') {
          setEditing(false)
        }
      }}
      className="w-full min-w-0 rounded-sm bg-background px-1 font-semibold outline-none ring-1 ring-border focus:ring-ring"
    />
  )
}
