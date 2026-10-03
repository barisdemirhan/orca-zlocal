import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  normalizeAgentHubDefaultTab,
  normalizeAgentHubDockPosition,
  normalizeAgentHubFinishedClearMinutes,
  normalizeAgentHubPlacement,
  type AgentHubDefaultTab,
  type AgentHubDockPosition,
  type AgentHubPlacement
} from '../../../../shared/agent-hub-settings'

export type AgentHubPreferences = {
  placement: AgentHubPlacement
  dockPosition: AgentHubDockPosition
  dockAutoHide: boolean
  alertOnNeedsInput: boolean
  alertOnFinished: boolean
  alertSound: boolean
  alertsMutedUntil: number | null
  showShells: boolean
  finishedClearMinutes: number
  defaultTab: AgentHubDefaultTab
}

/** The hub's settings with defaults applied, so profiles saved before a key existed read sanely. */
export function useAgentHubPreferences(): AgentHubPreferences {
  const raw = useAppStore(
    useShallow((s) => ({
      placement: s.settings?.agentHubPlacement,
      dockPosition: s.settings?.agentHubDockPosition,
      dockAutoHide: s.settings?.agentHubDockAutoHide,
      alertOnNeedsInput: s.settings?.agentHubAlertOnNeedsInput,
      alertOnFinished: s.settings?.agentHubAlertOnFinished,
      alertSound: s.settings?.agentHubAlertSound,
      alertsMutedUntil: s.settings?.agentHubAlertsMutedUntil,
      showShells: s.settings?.agentHubShowShells,
      finishedClearMinutes: s.settings?.agentHubFinishedAutoClearMinutes,
      defaultTab: s.settings?.agentHubDefaultTab
    }))
  )
  return useMemo(
    () => ({
      placement: normalizeAgentHubPlacement(raw.placement),
      dockPosition: normalizeAgentHubDockPosition(raw.dockPosition),
      dockAutoHide: raw.dockAutoHide === true,
      alertOnNeedsInput: raw.alertOnNeedsInput !== false,
      alertOnFinished: raw.alertOnFinished !== false,
      alertSound: raw.alertSound !== false,
      alertsMutedUntil: typeof raw.alertsMutedUntil === 'number' ? raw.alertsMutedUntil : null,
      showShells: raw.showShells !== false,
      finishedClearMinutes: normalizeAgentHubFinishedClearMinutes(raw.finishedClearMinutes),
      defaultTab: normalizeAgentHubDefaultTab(raw.defaultTab)
    }),
    [raw]
  )
}
