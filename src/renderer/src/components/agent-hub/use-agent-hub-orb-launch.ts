import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { requestNativeChatComposerFocus } from '../native-chat/composer/focus/native-chat-composer-focus-intent'
import type { AgentHubOrbVoiceController } from './agent-hub-orb-voice-controller'
import type { AgentHubOrbVoiceSnapshot } from './agent-hub-orb-voice-state'
import { useAgentHubOrbPanel, type AgentHubOrbLaunchRequest } from './agent-hub-orb-panel-store'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { readAgentHubDictationSession } from './agent-hub-dictation-origin'
import {
  finishAgentHubOrbDictationForText,
  startAgentHubOrbComposerDictation,
  useAgentHubOrbComposerReady
} from './agent-hub-orb-composer'

function currentLaunch(request: AgentHubOrbLaunchRequest): boolean {
  const panel = useAgentHubOrbPanel.getState()
  return (
    panel.session?.sessionId === request.sessionId &&
    panel.session.tabId === request.tabId &&
    panel.closeGeneration === request.closeGeneration &&
    panel.launchSequence === request.id
  )
}

export function useAgentHubOrbLaunch(
  controller: AgentHubOrbVoiceController | null,
  snapshot: AgentHubOrbVoiceSnapshot,
  visible: boolean
): void {
  const request = useAgentHubOrbPanel((state) => state.launchRequest)
  const composerReady = useAgentHubOrbComposerReady(request?.tabId)
  const preparingDictation = useRef<AgentHubOrbLaunchRequest | null>(null)
  const [preparedDictation, setPreparedDictation] = useState<AgentHubOrbLaunchRequest | null>(null)
  useEffect(() => {
    if (
      !request ||
      !controller ||
      !visible ||
      useAgentHubOrbPanel.getState().launchRequest !== request ||
      !currentLaunch(request) ||
      controller.owner.sessionId !== request.sessionId ||
      controller.owner.tabId !== request.tabId ||
      controller.owner.hostKey !== 'local'
    ) {
      return
    }
    if (
      request.action === 'live' &&
      (snapshot.capability === 'checking' ||
        (snapshot.capability === 'unknown' && !snapshot.canStart))
    ) {
      return
    }
    if (request.action !== 'text' && isDictationRunning(useAppStore.getState().dictationState)) {
      useAgentHubOrbPanel.setState({ launchRequest: null })
      if (readAgentHubDictationSession()?.pane?.tabId !== request.tabId) {
        toast.info(
          translate(
            'agentHub.orb.microphoneBusy',
            'The microphone is already in use by another recording.'
          )
        )
      }
      return
    }
    if (request.action === 'dictate') {
      useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
      if (preparedDictation !== request) {
        if (preparingDictation.current !== request) {
          preparingDictation.current = request
          void controller.prepareDictation().then((ready) => {
            if (
              currentLaunch(request) &&
              useAgentHubOrbPanel.getState().launchRequest === request
            ) {
              if (ready) {
                setPreparedDictation(request)
              } else {
                useAgentHubOrbPanel.setState({ launchRequest: null })
              }
            }
          })
        }
        return
      }
      if (!composerReady) {
        return
      }
      useAgentHubOrbPanel.setState({ launchRequest: null })
      startAgentHubOrbComposerDictation(request.tabId)
    } else if (request.action === 'live') {
      useAgentHubOrbPanel.setState({ launchRequest: null })
      void controller.startLive()
    } else {
      useAgentHubOrbPanel.setState({ launchRequest: null })
      finishAgentHubOrbDictationForText(request.tabId)
      void controller.switchToText().then(() => {
        if (currentLaunch(request)) {
          useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
          requestNativeChatComposerFocus(request.tabId)
        }
      })
    }
  }, [
    request,
    controller,
    composerReady,
    preparedDictation,
    snapshot.capability,
    snapshot.canStart,
    visible
  ])
}
