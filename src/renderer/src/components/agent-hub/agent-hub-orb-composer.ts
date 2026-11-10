import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type RefObject
} from 'react'
import { useAppStore } from '@/store'
import type { NativeChatComposerInput } from '../native-chat/composer/editor/native-chat-composer-input'
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
import {
  agentHubOrbVoiceCommandAvailable,
  runAgentHubOrbVoiceCommand
} from './agent-hub-orb-voice-commands'
import { agentHubOrbLaunchAction } from '../../../../shared/agent-hub-orb-settings'

export const AgentHubOrbComposerContext = createContext<string | null>(null)
type OrbComposer = {
  input: RefObject<NativeChatComposerInput | null>
  ready: () => boolean
  send: () => void
  finishWithoutSending: () => void
}
const composers = new Map<string, OrbComposer>()
const composerListeners = new Set<() => void>()
const notifyComposers = (): void => {
  for (const listener of composerListeners) {
    listener()
  }
}
const subscribeComposers = (listener: () => void): (() => void) => {
  composerListeners.add(listener)
  return () => {
    composerListeners.delete(listener)
  }
}

export function useAgentHubOrbComposerReady(tabId: string | undefined): boolean {
  return useSyncExternalStore(
    subscribeComposers,
    () => Boolean(tabId && composers.get(tabId)?.ready()),
    () => false
  )
}

/** Sends a line written outside the chat through its composer; false when nothing could go. */
export function sendAgentHubOrbText(tabId: string, text: string): boolean {
  const message = text.trim()
  const composer = composers.get(tabId)
  const input = composer?.input.current
  if (!message || !composer?.ready() || !input?.insertText) {
    return false
  }
  input.insertText(message)
  // Why: the composer reads its draft from React state, which the insert only updates next frame.
  requestAnimationFrame(() => composers.get(tabId)?.send())
  return true
}

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
  send: () => void,
  enabled = true
): void {
  const tabId = useContext(AgentHubOrbComposerContext)
  const sendRef = useRef(send)
  sendRef.current = send
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  useEffect(notifyComposers, [enabled])
  useEffect(() => {
    if (!tabId) {
      return
    }
    let pendingSend = false
    let frame: number | null = null
    const composer = {
      input,
      ready: () => enabledRef.current && input.current !== null && !input.current.disabled,
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
    notifyComposers()
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
        notifyComposers()
      }
    }
  }, [input, tabId])
}

export function activateAgentHubOrb(): void {
  const panel = useAgentHubOrbPanel.getState()
  if (
    panel.session?.tabId &&
    readAgentHubDictationSession()?.pane?.tabId === panel.session.tabId &&
    isDictationRunning(useAppStore.getState().dictationState)
  ) {
    toggleAgentHubOrb()
    return
  }
  // Once the Orb is open, its chord turns Live on and off; a call still connecting is left alone.
  if (panel.session?.tabId) {
    if (agentHubOrbVoiceCommandAvailable('toggleOrbLive')) {
      runAgentHubOrbVoiceCommand('toggleOrbLive')
      return
    }
    const connection = readAgentHubOrbVoice(panel.session.tabId)?.getSnapshot().connection
    if (connection === 'connecting' || connection === 'stopping') {
      return
    }
  }
  void openAgentHubOrb(undefined, false, agentHubOrbLaunchAction(useAppStore.getState().settings))
}

export function startAgentHubOrbComposerDictation(tabId: string): boolean {
  const panel = useAgentHubOrbPanel.getState()
  const state = useAppStore.getState()
  const input = composers.get(tabId)?.input.current
  if (
    panel.session?.tabId !== tabId ||
    !panel.chatVisible ||
    isDictationRunning(state.dictationState) ||
    !input ||
    input.disabled ||
    state.settings?.voice?.enabled !== true ||
    !state.settings.voice.sttModel
  ) {
    return false
  }
  input.focus()
  startAgentHubDictation(normalizeAgentHubMicMode(state.settings.agentHubMicMode) === 'improve')
  return true
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
  startAgentHubOrbComposerDictation(panel.session.tabId)
}
