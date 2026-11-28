import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import type { DictationState } from '../../../../shared/speech/speech-types'
import {
  isDictationRunning,
  type AgentHubDictationPane,
  type AgentHubDictationSession
} from './agent-hub-mirror-mic-state'

let session: AgentHubDictationSession | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSession(next: AgentHubDictationSession | null): void {
  session = next
  listeners.forEach((listener) => listener())
}

/** The pane dictation would insert into: the focused terminal, as the dictation feature reads it. */
export function readFocusedTerminalPane(): AgentHubDictationPane | null {
  let active = document.activeElement
  if (active instanceof HTMLElement) {
    const portal = active.closest<HTMLElement>(
      '[data-slot="popover-content"], [data-slot="dropdown-menu-content"]'
    )
    // Portalled composer menus keep their owner through Radix's aria-controls link.
    if (portal?.id) {
      active =
        [...document.querySelectorAll<HTMLElement>('[aria-controls]')].find(
          (trigger) => trigger.getAttribute('aria-controls') === portal.id
        ) ?? active
    }
    const orb = active.closest<HTMLElement>('[data-agent-hub-orb-chat-tab-id]')
    if (orb?.dataset.agentHubOrbChatTabId) {
      return { tabId: orb.dataset.agentHubOrbChatTabId, leafId: null }
    }
  }
  if (!(active instanceof HTMLElement) || !active.classList.contains('xterm-helper-textarea')) {
    return null
  }
  const tabId = active.closest<HTMLElement>('[data-terminal-tab-id]')?.dataset.terminalTabId
  if (!tabId) {
    return null
  }
  const leafId = active.closest<HTMLElement>('.pane[data-leaf-id]')?.dataset.leafId ?? null
  return { tabId, leafId }
}

/**
 * Follows the app's dictation state. The pane is read once, as a dictation starts, and kept until
 * it ends: focus moving afterwards does not move the dictation.
 */
export function noteAgentHubDictationState(state: DictationState): void {
  const running = isDictationRunning(state)
  if (running && !session) {
    setSession({ pane: readFocusedTerminalPane() })
  } else if (!running && session) {
    setSession(null)
  }
}

/** Starts following dictation; returns the stop function. One tracker serves every mirror. */
export function trackAgentHubDictationOrigin(): () => void {
  // A dictation already running has an origin nobody saw: it counts as elsewhere.
  if (isDictationRunning(useAppStore.getState().dictationState) && !session) {
    setSession({ pane: null })
  }
  const unsubscribe = useAppStore.subscribe((state, previous) => {
    if (state.dictationState !== previous.dictationState) {
      noteAgentHubDictationState(state.dictationState)
    }
  })
  return () => {
    unsubscribe()
    if (session) {
      setSession(null)
    }
  }
}

export function useAgentHubDictationSession(): AgentHubDictationSession | null {
  return useSyncExternalStore(subscribe, () => session)
}

export function readAgentHubDictationSession(): AgentHubDictationSession | null {
  return session
}
