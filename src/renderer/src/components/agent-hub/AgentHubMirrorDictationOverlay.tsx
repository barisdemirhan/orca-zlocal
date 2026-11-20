import { useAppStore } from '@/store'
import { AgentHubDictationPill } from './AgentHubDictationPill'
import { useMirrorShowsDictation } from './agent-hub-mirror-dictation-display'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubMirrorMicState } from './use-agent-hub-mirror-mic-state'

/**
 * Covers a mirror's terminal while a dictation that started there runs: a soft scrim and the
 * listening indicator inside the window, so it is plain which window is being dictated into.
 * The app-wide indicator stands down meanwhile and returns when this window goes away.
 */
export function AgentHubMirrorDictationOverlay({
  target,
  showsTerminal
}: {
  target: AgentHubPaneTarget
  /** False while the pane is elsewhere on screen; the app-wide indicator serves then. */
  showsTerminal: boolean
}): React.JSX.Element | null {
  const state = useAgentHubMirrorMicState(target, showsTerminal)
  // Why only 'stopping': a later phase this indicator has no controls for stays with the app's.
  const stopping = useAppStore((s) => s.dictationState === 'stopping')
  const phase =
    showsTerminal &&
    (state === 'starting' || state === 'listening' || (state === 'finishing' && stopping))
      ? state
      : null
  useMirrorShowsDictation(phase !== null)
  if (!phase) {
    return null
  }
  return (
    <div
      data-agent-hub-mirror-dictation={phase}
      // Why no pointer events: the terminal under the scrim stays usable; only the pill takes clicks.
      className="pointer-events-none absolute inset-0 z-10 flex animate-in items-end justify-center bg-background/50 pb-3 duration-150 fade-in-0"
    >
      <AgentHubDictationPill phase={phase} />
    </div>
  )
}
