import { useCallback, useLayoutEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import {
  AGENT_HUB_ORB_DEFAULT_DIAMETER,
  AGENT_HUB_ORB_MAX_DIAMETER,
  AGENT_HUB_ORB_MIN_DIAMETER
} from './agent-hub-orb-geometry'

export function useAgentHubOrbDiameter() {
  const preferredDiameter = useAgentHubOrbPanel((state) => state.preferredDiameter)
  const savedDiameter = useAppStore((state) => state.settings?.agentHubOrbDiameter)
  const restored = useRef(false)
  useLayoutEffect(() => {
    if (restored.current || typeof savedDiameter !== 'number' || !Number.isFinite(savedDiameter)) {
      return
    }
    restored.current = true
    if (useAgentHubOrbPanel.getState().preferredDiameter === AGENT_HUB_ORB_DEFAULT_DIAMETER) {
      useAgentHubOrbPanel.setState({
        preferredDiameter: Math.max(
          AGENT_HUB_ORB_MIN_DIAMETER,
          Math.min(AGENT_HUB_ORB_MAX_DIAMETER, savedDiameter)
        )
      })
    }
  }, [savedDiameter])

  const rememberDiameter = useCallback((diameter: number): void => {
    restored.current = true
    void useAppStore.getState().updateSettings({ agentHubOrbDiameter: diameter })
  }, [])
  return { preferredDiameter, rememberDiameter }
}
