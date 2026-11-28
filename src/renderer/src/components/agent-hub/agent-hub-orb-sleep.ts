import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { readAgentHubDictationSession } from './agent-hub-dictation-origin'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { beginAgentHubOrbReturn } from './agent-hub-orb-flight-store'
import { readAgentHubOrbVoice } from './agent-hub-orb-voice-context'
import { agentHubOrbErrorMessage } from './agent-hub-orb-error'
import { readAgentHubOrbName } from './use-agent-hub-orb-identity'

/** The sphere flies back to its launcher while the session closes; nothing waits for the flight. */
function closeToSlot(): void {
  try {
    if (useAgentHubOrbPanel.getState().session) {
      beginAgentHubOrbReturn()
    }
  } finally {
    closeAgentHubOrbPanel()
  }
}

/** Hide keeps the session running behind the sphere; Sleep ends it, leaving it in History. */
export async function sleepAgentHubOrb(): Promise<void> {
  const { session, presentation, chatVisible } = useAgentHubOrbPanel.getState()
  const tabId = session?.tabId
  const stayOpen = presentation === 'chat' && chatVisible
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
    if (stayOpen) {
      // Why: set before the host answers, so an Orb opened meanwhile is not marked asleep.
      closeAgentHubOrbPanel()
      useAgentHubOrbPanel.setState({ asleep: true, presentation: 'chat' })
    } else {
      closeToSlot()
    }
    await window.api.agentHub.orb.close()
    toast(
      translate('agentHub.orb.asleepNamed', '{{name}} is asleep. The conversation is in History.', {
        name: readAgentHubOrbName()
      })
    )
  } catch (error) {
    closeToSlot()
    toast.error(
      agentHubOrbErrorMessage(
        error,
        translate('agentHub.orb.sleepFailed', 'Could not put Orb to sleep. Try again.')
      )
    )
  }
}
