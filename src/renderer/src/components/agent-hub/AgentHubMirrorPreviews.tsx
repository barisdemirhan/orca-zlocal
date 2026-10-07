import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import type { AgentHubMirrorWindowState, AgentHubMirrorTab } from './agent-hub-mirror-membership'
import { resolveAgentHubTerminalInput } from './agent-hub-pane-target'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'

function PreviewEntry({
  entry,
  active,
  visible
}: {
  entry: AgentHubMirrorTab
  active: boolean
  visible: boolean
}): React.JSX.Element {
  const target = entry.target
  const ptyId = useAgentHubLivePty(target.worktree.id, target.tab.id, target.paneKey, false)
  const input = useAppStore(
    useShallow((state) => (ptyId ? resolveAgentHubTerminalInput(state, target, ptyId) : null))
  )
  return (
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
  )
}

export function AgentHubMirrorPreviews({
  window,
  visible
}: {
  window: AgentHubMirrorWindowState
  visible: boolean
}): React.JSX.Element {
  const visited = useRef(new Set<string>())
  visited.current.add(window.activeTabId)
  return (
    <>
      {window.tabs
        .filter(
          (entry) =>
            visited.current.has(entry.id) &&
            entry.target.worktree.id === FLOATING_TERMINAL_WORKTREE_ID
        )
        .map((entry) => (
          <PreviewEntry
            key={entry.id}
            entry={entry}
            active={entry.id === window.activeTabId}
            visible={visible}
          />
        ))}
    </>
  )
}
