import { useEffect, useRef } from 'react'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'
import { readAgentHubOrbVoice } from './agent-hub-orb-voice-context'
import type { AgentHubOrbVoiceSnapshot } from './agent-hub-orb-voice-state'
import { OrbAwarenessDelivery } from './agent-hub-orb-awareness-delivery'

export function useAgentHubOrbAwarenessDelivery(
  tabId: string | undefined,
  voice: AgentHubOrbVoiceSnapshot
): void {
  const snapshot = useAgentHubOrbAwarenessStore((state) => state.snapshot)
  const delivery = useRef<OrbAwarenessDelivery | null>(null)
  useEffect(() => {
    const stream = new OrbAwarenessDelivery((state) =>
      useAgentHubOrbAwarenessStore.setState({ delivery: state })
    )
    delivery.current = stream
    return () => {
      stream.dispose()
      delivery.current = null
    }
  }, [])
  useEffect(() => {
    const stream = delivery.current
    const controller = tabId ? readAgentHubOrbVoice(tabId) : null
    return stream?.updateContext(
      controller && snapshot && voice.connection === 'live'
        ? {
            context: controller.context,
            snapshot,
            busy: Boolean(voice.inputSpeaking || voice.output === 'speaking')
          }
        : null
    )
  }, [tabId, snapshot, voice.connection, voice.inputSpeaking, voice.output])
}
