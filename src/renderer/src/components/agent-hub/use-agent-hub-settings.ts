import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  normalizeAgentHubDefaultTab,
  normalizeAgentHubDockPosition,
  normalizeAgentHubDockSize,
  normalizeAgentHubFinishedClearMinutes,
  normalizeAgentHubMirrorWindowCap,
  normalizeAgentHubPlacement,
  normalizeAgentHubTrayPeekSeconds,
  type AgentHubDefaultTab,
  type AgentHubDockPosition,
  type AgentHubDockSize,
  type AgentHubPlacement
} from '../../../../shared/agent-hub-settings'

export type AgentHubPreferences = {
  placement: AgentHubPlacement
  dockPosition: AgentHubDockPosition
  dockSize: AgentHubDockSize
  dockAutoHide: boolean
  alertOnNeedsInput: boolean
  alertOnFinished: boolean
  alertSound: boolean
  alertsMutedUntil: number | null
  showShells: boolean
  finishedClearMinutes: number
  trayPeekSeconds: number
  mirrorWindowCap: number
  defaultTab: AgentHubDefaultTab
  tabAutoPopout: boolean
  canvas: boolean
}

/** The hub's settings with defaults applied, so profiles saved before a key existed read sanely. */
export function useAgentHubPreferences(): AgentHubPreferences {
  const raw = useAppStore(
    useShallow((s) => ({
      placement: s.settings?.agentHubPlacement,
      dockPosition: s.settings?.agentHubDockPosition,
      dockSize: s.settings?.agentHubDockSize,
      dockAutoHide: s.settings?.agentHubDockAutoHide,
      alertOnNeedsInput: s.settings?.agentHubAlertOnNeedsInput,
      alertOnFinished: s.settings?.agentHubAlertOnFinished,
      alertSound: s.settings?.agentHubAlertSound,
      alertsMutedUntil: s.settings?.agentHubAlertsMutedUntil,
      showShells: s.settings?.agentHubShowShells,
      finishedClearMinutes: s.settings?.agentHubFinishedAutoClearMinutes,
      trayPeekSeconds: s.settings?.agentHubTrayPeekSeconds,
      mirrorWindowCap: s.settings?.agentHubMirrorWindowCap,
      defaultTab: s.settings?.agentHubDefaultTab,
      tabAutoPopout: s.settings?.agentHubTabAutoPopout,
      canvas: s.settings?.agentHubCanvas
    }))
  )
  return useMemo(
    () => ({
      placement: normalizeAgentHubPlacement(raw.placement),
      dockPosition: normalizeAgentHubDockPosition(raw.dockPosition),
      dockSize: normalizeAgentHubDockSize(raw.dockSize),
      dockAutoHide: raw.dockAutoHide === true,
      alertOnNeedsInput: raw.alertOnNeedsInput !== false,
      alertOnFinished: raw.alertOnFinished !== false,
      alertSound: raw.alertSound !== false,
      alertsMutedUntil: typeof raw.alertsMutedUntil === 'number' ? raw.alertsMutedUntil : null,
      showShells: raw.showShells !== false,
      finishedClearMinutes: normalizeAgentHubFinishedClearMinutes(raw.finishedClearMinutes),
      trayPeekSeconds: normalizeAgentHubTrayPeekSeconds(raw.trayPeekSeconds),
      mirrorWindowCap: normalizeAgentHubMirrorWindowCap(raw.mirrorWindowCap),
      defaultTab: normalizeAgentHubDefaultTab(raw.defaultTab),
      tabAutoPopout: raw.tabAutoPopout === true,
      canvas: raw.canvas !== false
    }),
    [raw]
  )
}
