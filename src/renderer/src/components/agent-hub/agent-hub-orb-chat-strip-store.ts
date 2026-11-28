import { create } from 'zustand'
import { useAppStore } from '@/store'
import {
  AGENT_HUB_ORB_HOME_CHAT,
  EMPTY_ORB_STRIP,
  activateOrbStripChat,
  closeOrbStripChat,
  openOrbStripChat,
  type OrbStripChatStatus,
  type OrbStripState
} from './agent-hub-orb-chat-strip'

export type AgentHubOrbWindowTab = 'chat' | 'home' | 'chats' | 'connectors' | 'activity'

/** A worker opened read only: its Dispatch, to reopen it as a main tab. */
export type OrbStripWorker = { dispatchId: string; worktreeId: string; agent?: string }

export type OrbStripChatMeta = {
  title: string
  renamed: boolean
  tabId: string
  worker?: OrbStripWorker
}

type StripStoreState = {
  strip: OrbStripState
  meta: Record<string, OrbStripChatMeta>
  /** The chat that holds Live; null follows the shown chat. */
  liveId: string | null
  /** "Move Live here" was pressed while Live ran: start Live again once it is rebound. */
  restartLive: boolean
  windowTab: AgentHubOrbWindowTab
  /** A side chat left the strip on its own to make room; the strip says so once. */
  lastEvicted: string | null
  blocked: boolean
}

export const useAgentHubOrbChatStrip = create<StripStoreState>(() => ({
  strip: EMPTY_ORB_STRIP,
  meta: {},
  liveId: null,
  restartLive: false,
  windowTab: 'chat',
  lastEvicted: null,
  blocked: false
}))

/** Session-remembered: the strip survives the window closing and reopening, not an app restart. */
export function openAgentHubOrbStripChat(
  sessionId: string,
  limit: number,
  statusOf: (id: string) => OrbStripChatStatus,
  tabId: string,
  title: string,
  worker?: OrbStripWorker
): boolean {
  const state = useAgentHubOrbChatStrip.getState()
  const result = openOrbStripChat(state.strip, sessionId, limit, statusOf, Date.now())
  if (result.blocked) {
    useAgentHubOrbChatStrip.setState({ blocked: true })
    return false
  }
  const meta = { ...state.meta }
  if (result.evicted) {
    delete meta[result.evicted]
  }
  meta[sessionId] = {
    title: meta[sessionId]?.renamed ? meta[sessionId].title : title,
    renamed: meta[sessionId]?.renamed ?? false,
    tabId,
    ...(worker ? { worker } : {})
  }
  useAgentHubOrbChatStrip.setState({
    strip: result.state,
    meta,
    blocked: false,
    lastEvicted: result.evicted,
    liveId: result.evicted && state.liveId === result.evicted ? null : state.liveId
  })
  return true
}

export function closeAgentHubOrbStripChat(sessionId: string): void {
  const state = useAgentHubOrbChatStrip.getState()
  const meta = { ...state.meta }
  delete meta[sessionId]
  useAgentHubOrbChatStrip.setState({
    strip: closeOrbStripChat(state.strip, sessionId),
    meta,
    blocked: false,
    liveId: state.liveId === sessionId ? null : state.liveId
  })
}

export function activateAgentHubOrbStripChat(sessionId: string): void {
  const state = useAgentHubOrbChatStrip.getState()
  useAgentHubOrbChatStrip.setState({
    strip: activateOrbStripChat(state.strip, sessionId, Date.now()),
    blocked: false
  })
}

export function renameAgentHubOrbStripChat(sessionId: string, title: string): void {
  const state = useAgentHubOrbChatStrip.getState()
  const tabId = state.meta[sessionId]?.tabId
  // Why: the chat's own name, so Chats, tabs and Session History show the same title.
  if (tabId) {
    useAppStore.getState().setTabCustomTitle(tabId, title)
  }
  useAgentHubOrbChatStrip.setState({
    meta: state.meta[sessionId]
      ? { ...state.meta, [sessionId]: { ...state.meta[sessionId], title, renamed: true } }
      : state.meta
  })
}

export function moveAgentHubOrbLiveTo(sessionId: string | null): void {
  useAgentHubOrbChatStrip.setState({ liveId: sessionId })
}

export function resetAgentHubOrbStripToHome(): void {
  useAgentHubOrbChatStrip.setState({
    strip: activateOrbStripChat(
      useAgentHubOrbChatStrip.getState().strip,
      AGENT_HUB_ORB_HOME_CHAT,
      Date.now()
    ),
    blocked: false
  })
}

export function setAgentHubOrbWindowTab(windowTab: AgentHubOrbWindowTab): void {
  useAgentHubOrbChatStrip.setState({ windowTab })
}

/** Frees Live from its chat so it follows the shown one; `restart` starts it there again. */
export function moveAgentHubOrbLiveHere(restart: boolean): void {
  useAgentHubOrbChatStrip.setState({ liveId: null, restartLive: restart })
}

export function clearAgentHubOrbLiveRestart(): void {
  useAgentHubOrbChatStrip.setState({ restartLive: false })
}
