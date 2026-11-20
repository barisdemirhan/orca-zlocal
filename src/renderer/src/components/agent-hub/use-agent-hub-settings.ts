import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  normalizeAgentHubAlertOnInfo,
  normalizeAgentHubAnswerQueue,
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
  answerQueue: boolean
  answerQueueOpening: 'automatically' | 'shortcut'
  answerQueueIncludeApprovals: boolean
  agentControl: boolean
  placement: AgentHubPlacement
  dockPosition: AgentHubDockPosition
  dockSize: AgentHubDockSize
  dockAutoHide: boolean
  alertOnNeedsInput: boolean
  alertOnFinished: boolean
  alertOnInfo: boolean
  alertSound: boolean
  focusedPaneOutline: boolean
  paneQuickReply: boolean
  alertsMutedUntil: number | null
  showShells: boolean
  finishedClearMinutes: number
  trayPeekSeconds: number
  mirrorWindowCap: number
  defaultTab: AgentHubDefaultTab
  tabAutoPopout: boolean
  canvas: boolean
  restoreOnLaunch: boolean
}

/** The hub's settings with defaults applied, so profiles saved before a key existed read sanely. */
export function useAgentHubPreferences(): AgentHubPreferences {
  const raw = useAppStore(
    useShallow((s) => ({
      agentControl: s.settings?.agentHubAgentControl,
      agentHubAnswerQueue: s.settings?.agentHubAnswerQueue,
      agentHubAnswerQueueOpening: s.settings?.agentHubAnswerQueueOpening,
      agentHubAnswerQueueIncludeApprovals: s.settings?.agentHubAnswerQueueIncludeApprovals,
      placement: s.settings?.agentHubPlacement,
      dockPosition: s.settings?.agentHubDockPosition,
      dockSize: s.settings?.agentHubDockSize,
      dockAutoHide: s.settings?.agentHubDockAutoHide,
      alertOnNeedsInput: s.settings?.agentHubAlertOnNeedsInput,
      alertOnFinished: s.settings?.agentHubAlertOnFinished,
      alertOnInfo: s.settings?.agentHubAlertOnInfo,
      alertSound: s.settings?.agentHubAlertSound,
      focusedPaneOutline: s.settings?.agentHubFocusedPaneOutline,
      paneQuickReply: s.settings?.agentHubPaneQuickReply,
      alertsMutedUntil: s.settings?.agentHubAlertsMutedUntil,
      showShells: s.settings?.agentHubShowShells,
      finishedClearMinutes: s.settings?.agentHubFinishedAutoClearMinutes,
      trayPeekSeconds: s.settings?.agentHubTrayPeekSeconds,
      mirrorWindowCap: s.settings?.agentHubMirrorWindowCap,
      defaultTab: s.settings?.agentHubDefaultTab,
      tabAutoPopout: s.settings?.agentHubTabAutoPopout,
      canvas: s.settings?.agentHubCanvas,
      restoreOnLaunch: s.settings?.agentHubRestoreOnLaunch
    }))
  )
  return useMemo(
    () => ({
      ...normalizeAgentHubAnswerQueue(raw),
      agentControl: raw.agentControl !== false,
      placement: normalizeAgentHubPlacement(raw.placement),
      dockPosition: normalizeAgentHubDockPosition(raw.dockPosition),
      dockSize: normalizeAgentHubDockSize(raw.dockSize),
      dockAutoHide: raw.dockAutoHide === true,
      alertOnNeedsInput: raw.alertOnNeedsInput !== false,
      alertOnFinished: raw.alertOnFinished !== false,
      alertOnInfo: normalizeAgentHubAlertOnInfo(raw.alertOnInfo),
      alertSound: raw.alertSound !== false,
      focusedPaneOutline: raw.focusedPaneOutline !== false,
      paneQuickReply: raw.paneQuickReply !== false,
      alertsMutedUntil: typeof raw.alertsMutedUntil === 'number' ? raw.alertsMutedUntil : null,
      showShells: raw.showShells !== false,
      finishedClearMinutes: normalizeAgentHubFinishedClearMinutes(raw.finishedClearMinutes),
      trayPeekSeconds: normalizeAgentHubTrayPeekSeconds(raw.trayPeekSeconds),
      mirrorWindowCap: normalizeAgentHubMirrorWindowCap(raw.mirrorWindowCap),
      defaultTab: normalizeAgentHubDefaultTab(raw.defaultTab),
      tabAutoPopout: raw.tabAutoPopout === true,
      canvas: raw.canvas !== false,
      restoreOnLaunch: raw.restoreOnLaunch !== false
    }),
    [raw]
  )
}
