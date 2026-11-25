import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import {
  createAgentHubMirrorDrawerModel,
  type AgentHubMirrorDrawer
} from './agent-hub-mirror-drawer-model'

export type {
  AgentHubMirrorDrawer,
  AgentHubMirrorDrawerOpenResult,
  AgentHubMirrorEvent,
  AgentHubMirrorEventKind,
  AgentHubMirrorSourceKey
} from './agent-hub-mirror-drawer-model'

const model = createAgentHubMirrorDrawerModel({
  ownCardAllowed: () =>
    agentHubSurfaceSetting(useAppStore.getState().settings, 'agentHubAgentOwnCard')
})

export const openAgentHubMirrorDrawer = model.open
export const closeAgentHubMirrorDrawer = model.close
export const readAgentHubMirrorDrawer = model.shown
export const readAgentHubMirrorStripPref = model.stripPref
export const noteAgentHubMirrorTurnStarted = model.noteTurnStarted
export const agentMayUseCard = model.agentMayUseCard
export const recordAgentHubMirrorEvent = model.recordEvent
export const readAgentHubMirrorEvents = model.readEvents
export const setAgentMayUseCard = model.setAgentMayUseCard
export const setAgentHubMirrorStripShown = model.setStripShown

export function useAgentHubMirrorDrawer(sourceKey: string): AgentHubMirrorDrawer | null {
  return useSyncExternalStore(model.subscribe, () => model.shown(sourceKey))
}

/** The card's own "Let this agent use its card" switch; the settings gate is applied by agentMayUseCard. */
export function useAgentHubMirrorAgentPref(sourceKey: string): boolean {
  return useSyncExternalStore(model.subscribe, () => model.agentPref(sourceKey))
}

export function useAgentHubMirrorStripShown(sourceKey: string): boolean {
  const settingDefault = useAppStore((s) =>
    agentHubSurfaceSetting(s.settings, 'agentHubMirrorWorkStrip')
  )
  const own = useSyncExternalStore(model.subscribe, () => model.stripPref(sourceKey))
  return own ?? settingDefault
}
