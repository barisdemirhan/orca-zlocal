import { useAppStore } from '@/store'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import {
  agentHubMirrorDictationPane,
  agentHubMirrorMicState,
  isSpeechModelReady,
  mirrorOwnsDictation,
  type AgentHubMirrorMicState
} from './agent-hub-mirror-mic-state'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubPaneQuickReplyOpen } from './agent-hub-pane-quick-reply-presence'

/** What a mirror's microphone shows: dictation for this pane, elsewhere, or why it cannot start. */
export function useAgentHubMirrorMicState(
  target: Pick<AgentHubPaneTarget, 'tab' | 'paneKey'>,
  reachable: boolean
): AgentHubMirrorMicState {
  const dictationState = useAppStore((s) => s.dictationState)
  const voiceEnabled = useAppStore((s) => s.settings?.voice?.enabled === true)
  const modelReady = useAppStore((s) =>
    isSpeechModelReady(s.settings?.voice?.sttModel, s.modelStates)
  )
  const session = useAgentHubDictationSession()
  const answeringInCard = useAgentHubPaneQuickReplyOpen(target.tab.id, target.paneKey)
  return agentHubMirrorMicState({
    dictationState,
    ownsDictation: mirrorOwnsDictation(session, agentHubMirrorDictationPane(target)),
    voiceEnabled,
    modelReady,
    reachable,
    answeringInCard
  })
}
