import { useRef } from 'react'
import { RetainedPaneHost } from '../tab-group/retained-pane/RetainedPaneHost'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { AgentTerminalPreview } from '../dashboard/terminal-preview/AgentTerminalPreview'
import {
  shownAgentHubMirrorTarget,
  type AgentHubMirrorWindowState,
  type AgentHubMirrorTab
} from './agent-hub-mirror-membership'
import { resolveAgentHubTerminalInput } from './agent-hub-pane-target'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'

function PreviewEntry({
  entry,
  active,
  visible,
  destination
}: {
  entry: AgentHubMirrorTab
  active: boolean
  visible: boolean
  destination: HTMLElement | null
}): React.JSX.Element {
  const target = shownAgentHubMirrorTarget(entry)
  const ptyId = useAgentHubLivePty(target.worktree.id, target.tab.id, target.paneKey, false)
  const input = useAppStore(
    useShallow((state) => (ptyId ? resolveAgentHubTerminalInput(state, target, ptyId) : null))
  )
  return (
    <RetainedPaneHost
      groupId={undefined}
      isVisible={active && visible}
      retainContent
      destination={destination}
    >
      <div
        hidden={!active}
        inert={!active || !visible}
        data-agent-hub-preview-entry={entry.id}
        className="relative min-h-0 flex-1"
      >
        {ptyId ? (
          <AgentTerminalPreview
            key={ptyId}
            ptyId={ptyId}
            terminalInput={input}
            visible={active && visible}
            focusOnActivate={false}
            className="h-full"
          />
        ) : null}
      </div>
    </RetainedPaneHost>
  )
}

export function AgentHubMirrorPreviews({
  windows,
  slots,
  visible
}: {
  windows: readonly AgentHubMirrorWindowState[]
  slots: ReadonlyMap<string, HTMLElement>
  visible: boolean
}): React.JSX.Element {
  const visited = useRef(new Set<string>())
  for (const window of windows) {
    visited.current.add(window.activeTabId)
  }
  const entries = windows.flatMap((window) => window.tabs.map((entry) => ({ window, entry })))
  const present = new Set(entries.map((item) => item.entry.id))
  for (const id of visited.current) {
    if (!present.has(id)) {
      visited.current.delete(id)
    }
  }
  return (
    <>
      {entries
        .filter(
          ({ entry }) =>
            visited.current.has(entry.id) &&
            shownAgentHubMirrorTarget(entry).worktree.id === FLOATING_TERMINAL_WORKTREE_ID
        )
        .toSorted((a, b) => a.entry.id.localeCompare(b.entry.id))
        .map(({ window, entry }) => (
          <PreviewEntry
            key={entry.id}
            entry={entry}
            active={entry.id === window.activeTabId}
            visible={visible}
            destination={entry.id === window.activeTabId ? (slots.get(window.id) ?? null) : null}
          />
        ))}
    </>
  )
}
