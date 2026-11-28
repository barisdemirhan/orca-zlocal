import { createContext, useContext, useSyncExternalStore } from 'react'
import type { AgentHubOrbVoiceController } from './agent-hub-orb-voice-controller'
import { EMPTY_ORB_VOICE_SNAPSHOT } from './agent-hub-orb-voice-state'

export const AgentHubOrbVoiceContext = createContext<AgentHubOrbVoiceController | null>(null)
const controllers = new Map<string, AgentHubOrbVoiceController>()
const listeners = new Set<() => void>()
const notify = (): void => {
  for (const listener of listeners) {
    listener()
  }
}
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function registerAgentHubOrbVoice(controller: AgentHubOrbVoiceController): () => void {
  const tabId = controller.owner.tabId
  const previous = controllers.get(tabId)
  if (previous && previous !== controller) {
    void previous.stopLive()
  }
  controllers.set(tabId, controller)
  notify()
  return () => {
    if (controllers.get(tabId) === controller) {
      controllers.delete(tabId)
      notify()
    }
  }
}

export function readAgentHubOrbVoice(tabId: string): AgentHubOrbVoiceController | null {
  return controllers.get(tabId) ?? null
}

export function useRegisteredAgentHubOrbVoice(
  tabId: string,
  sessionId: string,
  hostKey: string
): AgentHubOrbVoiceController | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const controller = readAgentHubOrbVoice(tabId)
      return controller?.owner.sessionId === sessionId && controller.owner.hostKey === hostKey
        ? controller
        : null
    },
    () => null
  )
}

const emptySubscribe = (): (() => void) => () => {}
const emptySnapshot = () => EMPTY_ORB_VOICE_SNAPSHOT

export function useAgentHubOrbVoiceContext() {
  const controller = useContext(AgentHubOrbVoiceContext)
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? emptySubscribe,
    controller?.getSnapshot ?? emptySnapshot,
    emptySnapshot
  )
  return { controller, snapshot }
}
