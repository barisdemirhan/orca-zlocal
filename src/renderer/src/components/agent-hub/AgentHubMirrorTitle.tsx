import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { isImeOwnedKeyboardEvent } from '@/lib/text-input/ime/ime-composition-keyboard-event'
import { useStructuredChatTabNames } from '@/runtime/native-chat/naming/structured-chat-name-observation'
import { projectedStructuredChatTabSavedName } from '@/runtime/native-chat/naming/structured-chat-tab-name'
import { findAgentHubChatTab, isAgentHubChatTab } from './agent-hub-chat-tabs'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/** The tab's own name when the user gave it one, else the title the hub derived. */
export function useAgentHubTargetTitle(target: AgentHubPaneTarget): string {
  const chatNames = useStructuredChatTabNames()
  const customTitle = useAppStore((s) => {
    const chat = findAgentHubChatTab(s, target.tab.id)
    return chat
      ? (projectedStructuredChatTabSavedName(chat, chatNames) ?? chat.generatedLabel ?? null)
      : ((s.tabsByWorktree[target.worktree.id] ?? []).find((tab) => tab.id === target.tab.id)
          ?.customTitle ?? null)
  })
  return customTitle?.trim() || target.title
}

/** A mirror's title: double-click renames the terminal tab, like its tab in the workspace. */
export function AgentHubMirrorTitle({
  target,
  onEditingChange
}: {
  target: AgentHubPaneTarget
  onEditingChange?: (editing: boolean) => void
}): React.JSX.Element {
  const title = useAgentHubTargetTitle(target)
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)
  // A chat's name lives on its host and is changed from the chat's own tab.
  const renamable = useAppStore((s) => !isAgentHubChatTab(s, target.tab.id))
  const [editing, setEditing] = useState(false)
  useEffect(() => onEditingChange?.(editing), [editing, onEditingChange])
  if (!editing) {
    return (
      <div
        className="truncate font-semibold"
        title={
          renamable ? translate('agentHub.mirror.renameHint', 'Double-click to rename') : undefined
        }
        onDoubleClick={renamable ? () => setEditing(true) : undefined}
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
        if (isImeOwnedKeyboardEvent(event)) {
          return
        }
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
