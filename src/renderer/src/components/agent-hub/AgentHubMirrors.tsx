import type { AgentPaneThread } from '../activity/activity-thread-types'
import { AgentHubMirrorChip } from './AgentHubMirrorChip'
import { AgentHubMirrorWindow } from './AgentHubMirrorWindow'
import { dismissAgentHubAlert } from './agent-hub-alert-queue'
import type { AgentHubAlert } from './agent-hub-alerts'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  minimizeAgentHubMirror,
  moveAgentHubMirrorChip,
  restoreAgentHubMirror,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
import {
  agentHubPaneTargetKey,
  agentHubTargetShowsThread,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'

/** The open mirror window plus every minimized chip; a chip carries its own pane's alerts. */
export function AgentHubMirrors({
  threads,
  alerts,
  locationOf,
  onReveal,
  onOpenCard
}: {
  threads: readonly AgentPaneThread[]
  alerts: readonly AgentHubAlert[]
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  onReveal: (target: AgentHubPaneTarget, thread: AgentPaneThread | null) => void
  /** Opens the hub on this waiting agent's card. */
  onOpenCard: (paneKey: string) => void
}): React.JSX.Element {
  const { open, chips } = useAgentHubMirrors()
  const threadFor = (target: AgentHubPaneTarget): AgentPaneThread | null =>
    threads.find((thread) => agentHubTargetShowsThread(target, thread)) ?? null
  const openThread = open ? threadFor(open) : null

  return (
    <>
      {chips.map((chip) => {
        const key = agentHubPaneTargetKey(chip.target)
        const alert =
          alerts.findLast((candidate) =>
            agentHubTargetShowsThread(chip.target, candidate.thread)
          ) ?? null
        return (
          <AgentHubMirrorChip
            key={key}
            chip={chip}
            thread={threadFor(chip.target)}
            location={locationOf(chip.target)}
            alert={alert}
            onRestore={() => restoreAgentHubMirror(key)}
            onClose={() => closeAgentHubMirrorChip(key)}
            onMove={(position) => moveAgentHubMirrorChip(key, position)}
            onOpenAlert={(opened) => {
              dismissAgentHubAlert(opened.id)
              // A question is answered on its card; a result is read in the terminal.
              if (opened.kind === 'done') {
                restoreAgentHubMirror(key)
              } else {
                onOpenCard(opened.thread.paneKey)
              }
            }}
            onDismissAlert={dismissAgentHubAlert}
          />
        )
      })}
      {open ? (
        <AgentHubMirrorWindow
          key={agentHubPaneTargetKey(open)}
          target={open}
          thread={openThread}
          location={locationOf(open)}
          onClose={closeAgentHubMirror}
          onMinimize={minimizeAgentHubMirror}
          onReveal={() => {
            closeAgentHubMirror()
            onReveal(open, openThread)
          }}
        />
      ) : null}
    </>
  )
}
