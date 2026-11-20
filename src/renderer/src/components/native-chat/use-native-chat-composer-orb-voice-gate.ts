import { useCallback } from 'react'
import { useAgentHubOrbVoiceContext } from '../agent-hub/agent-hub-orb-voice-context'

/** True while an Orb voice session owns input, so the text field must stay disabled. */
export function useNativeChatComposerVoiceHoldsInput(): boolean {
  const orbVoice = useAgentHubOrbVoiceContext()
  return orbVoice.controller !== null && !orbVoice.snapshot.textMode
}

/** A send that does nothing while the Orb's voice mode (not text mode) is driving the session. */
export function useNativeChatComposerVoiceGatedSend(submit: () => void): () => void {
  const { controller } = useAgentHubOrbVoiceContext()
  return useCallback(() => {
    if (controller && !controller.getSnapshot().textMode) {
      return
    }
    submit()
  }, [controller, submit])
}
