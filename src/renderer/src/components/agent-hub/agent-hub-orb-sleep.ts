import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { readAgentHubDictationSession } from './agent-hub-dictation-origin'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { readAgentHubOrbVoice } from './agent-hub-orb-voice-context'
import { agentHubOrbErrorMessage } from './agent-hub-orb-error'
import { readAgentHubOrbName } from './use-agent-hub-orb-identity'

/** Hide keeps the session running behind the sphere; Sleep ends it, leaving it in History. */
export async function sleepAgentHubOrb(): Promise<void> {
  const tabId = useAgentHubOrbPanel.getState().session?.tabId
  if (
    tabId &&
    isDictationRunning(useAppStore.getState().dictationState) &&
    readAgentHubDictationSession()?.pane?.tabId === tabId
  ) {
    cancelDictation()
  }
  try {
    if (tabId) {
      await readAgentHubOrbVoice(tabId)?.stopLive()
    }
    closeAgentHubOrbPanel()
    await window.api.agentHub.orb.close()
    toast(
      translate('agentHub.orb.asleepNamed', '{{name}} is asleep. The conversation is in History.', {
        name: readAgentHubOrbName()
      })
    )
  } catch (error) {
    closeAgentHubOrbPanel()
    toast.error(
      agentHubOrbErrorMessage(
        error,
        translate('agentHub.orb.sleepFailed', 'Could not put Orb to sleep. Try again.')
      )
    )
  }
}
