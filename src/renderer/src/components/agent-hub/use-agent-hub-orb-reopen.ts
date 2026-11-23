import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { cancelAgentHubOrbLaunch, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { readAgentHubDictationSession } from './agent-hub-dictation-origin'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { agentHubOrbErrorMessage } from './agent-hub-orb-error'

/** Starting a new conversation or resuming a past one from inside the Orb. */
export function useAgentHubOrbReopen({
  sessionId,
  tabId,
  stopLive,
  refresh,
  onOpened
}: {
  sessionId: string
  tabId: string | undefined
  stopLive: () => Promise<void>
  refresh: () => Promise<void>
  onOpened: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{ message: string; resumeId?: string } | null>(null)
  const reopen = async (resumeId?: string): Promise<void> => {
    if (busy) {
      return
    }
    cancelAgentHubOrbLaunch(sessionId, tabId)
    setBusy(true)
    setFailure(null)
    if (
      tabId &&
      isDictationRunning(useAppStore.getState().dictationState) &&
      readAgentHubDictationSession()?.pane?.tabId === tabId
    ) {
      cancelDictation()
    }
    try {
      await stopLive()
      if (!resumeId) {
        await window.api.agentHub.orb.close()
      }
      const opened = await openAgentHubOrb(
        resumeId ? { resume: { sessionId: resumeId } } : { fresh: true }
      )
      if (!opened) {
        setFailure({
          message: translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.'),
          resumeId
        })
        return
      }
      const next = useAgentHubOrbPanel.getState().session
      if (next && (resumeId ? next.sessionId === resumeId : next.sessionId !== sessionId)) {
        onOpened()
      }
      await refresh()
    } catch (error) {
      setFailure({
        message: agentHubOrbErrorMessage(
          error,
          translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.')
        ),
        resumeId
      })
    } finally {
      setBusy(false)
    }
  }
  return { busy, failure, reopen }
}
