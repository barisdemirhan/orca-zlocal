import { create } from 'zustand'
import type { AgentHubOrbWindowTab } from './agent-hub-orb-chat-strip-store'

export type AgentHubMirrorBotTab = Exclude<AgentHubOrbWindowTab, 'chat'>

type MirrorBotView = { tab: AgentHubMirrorBotTab; settings: boolean }

const HOME_VIEW: MirrorBotView = { tab: 'home', settings: false }

const useMirrorBotViews = create<{ byWindowId: Readonly<Record<string, MirrorBotView>> }>(() => ({
  byWindowId: {}
}))

/** Each mirror window keeps its own tab, so one bot in two windows never moves the other's. */
export function useAgentHubMirrorBotView(windowId: string): MirrorBotView {
  return useMirrorBotViews((state) => state.byWindowId[windowId] ?? HOME_VIEW)
}

export function setAgentHubMirrorBotTab(windowId: string, tab: AgentHubMirrorBotTab): void {
  useMirrorBotViews.setState((state) => ({
    byWindowId: { ...state.byWindowId, [windowId]: { tab, settings: false } }
  }))
}

/** The bot's settings replace the Activity list until closed. */
export function setAgentHubMirrorBotSettings(windowId: string, settings: boolean): void {
  useMirrorBotViews.setState((state) => ({
    byWindowId: { ...state.byWindowId, [windowId]: { tab: 'activity', settings } }
  }))
}

/** The surface name an item ask uses to reach this mirror window's Activity tab. */
export function agentHubMirrorBotSurface(windowId: string): string {
  return `agent-hub-mirror:${windowId}`
}
