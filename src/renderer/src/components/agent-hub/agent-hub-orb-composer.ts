import { createContext, useContext, useEffect, useRef, type RefObject } from 'react'
import { useAppStore } from '@/store'
import type { NativeChatComposerInput } from '../native-chat/native-chat-composer-input'
import {
  DICTATION_CONTROL_EVENT,
  dispatchDictationControl
} from '../dictation/dictation-control-events'
import { normalizeAgentHubMicMode } from '../../../../shared/agent-hub-settings'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import {
  readAgentHubDictationSession,
  useAgentHubDictationSession
} from './agent-hub-dictation-origin'
import { startAgentHubDictation } from './agent-hub-dictation-improve'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { readAgentHubOrbVoice } from './agent-hub-orb-voice-context'

export const AgentHubOrbComposerContext = createContext<string | null>(null)
type OrbComposer = {
  input: RefObject<NativeChatComposerInput | null>
  send: () => void
  finishWithoutSending: () => void
}
const composers = new Map<string, OrbComposer>()

export function finishAgentHubOrbDictationForText(tabId: string | undefined): void {
  if (
    !tabId ||
    readAgentHubDictationSession()?.pane?.tabId !== tabId ||
    !isDictationRunning(useAppStore.getState().dictationState)
  ) {
    return
  }
  const composer = composers.get(tabId)
  if (composer) {
    composer.finishWithoutSending()
  } else {
    dispatchDictationControl('stop')
  }
}

export function useAgentHubOrbComposerDictation() {
  const tabId = useContext(AgentHubOrbComposerContext)
  const session = useAgentHubDictationSession()
  const state = useAppStore((s) => s.dictationState)
  const phase =
    tabId && session?.pane?.tabId === tabId && isDictationRunning(state)
      ? state === 'starting'
        ? ('starting' as const)
        : state === 'listening'
          ? ('listening' as const)
          : ('finishing' as const)
      : null
  return { session, phase }
}

export function useAgentHubOrbComposerBinding(
  input: RefObject<NativeChatComposerInput | null>,
  send: () => void
): void {
  const tabId = useContext(AgentHubOrbComposerContext)
  const sendRef = useRef(send)
  sendRef.current = send
  useEffect(() => {
    if (!tabId) {
      return
    }
    let pendingSend = false
    let frame: number | null = null
    const composer = {
      input,
      send: () => sendRef.current(),
      finishWithoutSending: () => {
        dispatchDictationControl('stop')
        pendingSend = false
        if (frame !== null) {
          cancelAnimationFrame(frame)
          frame = null
        }
      }
    }
    composers.set(tabId, composer)
    const control = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const action = typeof event.detail === 'string' ? event.detail : event.detail?.action
      if (action === 'cancel') {
        pendingSend = false
      } else if (
        (action === 'stop' || action === 'toggle') &&
        isDictationRunning(useAppStore.getState().dictationState) &&
        readAgentHubDictationSession()?.pane?.tabId === tabId
      ) {
        pendingSend = true
      }
    }
    // Observe the stop before the controller can synchronously finish an empty recording.
    document.addEventListener(DICTATION_CONTROL_EVENT, control, true)
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (
        pendingSend &&
        isDictationRunning(previous.dictationState) &&
        state.dictationState === 'idle'
      ) {
        pendingSend = false
        frame = requestAnimationFrame(() => {
          const panel = useAgentHubOrbPanel.getState()
          if (
            panel.session?.tabId === tabId &&
            panel.chatVisible &&
            input.current?.value.trim() &&
            readAgentHubOrbVoice(tabId)?.getSnapshot().textMode !== false
          ) {
            composers.get(tabId)?.send()
          }
        })
      } else if (!isDictationRunning(state.dictationState)) {
        pendingSend = false
      }
    })
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
      }
      document.removeEventListener(DICTATION_CONTROL_EVENT, control, true)
      unsubscribe()
      if (composers.get(tabId) === composer) {
        composers.delete(tabId)
      }
    }
  }, [input, tabId])
}

export function toggleAgentHubOrb(): void {
  const panel = useAgentHubOrbPanel.getState()
  if (!panel.session) {
    void openAgentHubOrb()
    return
  }
  if (!panel.chatVisible || !panel.session.tabId) {
    return
  }
  const state = useAppStore.getState()
  if (isDictationRunning(state.dictationState)) {
    if (
      readAgentHubDictationSession()?.pane?.tabId === panel.session.tabId &&
      state.dictationState !== 'stopping'
    ) {
      dispatchDictationControl('stop')
    }
    return
  }
  const voice = readAgentHubOrbVoice(panel.session.tabId)
  if (voice && !voice.getSnapshot().textMode) {
    void voice.prepareDictation().then((ready) => {
      const current = useAgentHubOrbPanel.getState()
      if (ready && current.session?.tabId === panel.session?.tabId && current.chatVisible) {
        toggleAgentHubOrb()
      }
    })
    return
  }
  const input = composers.get(panel.session.tabId)?.input.current
  if (
    !input ||
    input.disabled ||
    state.settings?.voice?.enabled !== true ||
    !state.settings.voice.sttModel
  ) {
    return
  }
  input.focus()
  startAgentHubDictation(normalizeAgentHubMicMode(state.settings.agentHubMicMode) === 'improve')
}
