export const AGENT_HUB_ORB_HOME_CHAT = 'home'

export type OrbStripChatStatus = 'working' | 'attention' | 'idle'

export type OrbStripChat = {
  /** Chat id; `home` is the Home chat and is never evicted. */
  id: string
  shownAt: number
}

export type OrbStripState = {
  chats: OrbStripChat[]
  activeId: string
}

export type OrbStripOpenResult = {
  state: OrbStripState
  evicted: string | null
  /** Strip is full and every other chat is busy; nothing was opened. */
  blocked: boolean
}

export const EMPTY_ORB_STRIP: OrbStripState = {
  chats: [{ id: AGENT_HUB_ORB_HOME_CHAT, shownAt: 0 }],
  activeId: AGENT_HUB_ORB_HOME_CHAT
}

/** Opens a chat as a tab; a full strip drops the longest-idle side chat, never a busy one. */
export function openOrbStripChat(
  state: OrbStripState,
  id: string,
  limit: number,
  statusOf: (id: string) => OrbStripChatStatus,
  now: number
): OrbStripOpenResult {
  const existing = state.chats.find((chat) => chat.id === id)
  if (existing) {
    return {
      state: {
        chats: state.chats.map((chat) => (chat.id === id ? { ...chat, shownAt: now } : chat)),
        activeId: id
      },
      evicted: null,
      blocked: false
    }
  }
  let chats = state.chats
  let evicted: string | null = null
  if (chats.length >= Math.max(limit, 1)) {
    const candidate = chats
      .filter((chat) => chat.id !== AGENT_HUB_ORB_HOME_CHAT && statusOf(chat.id) === 'idle')
      .reduce<OrbStripChat | null>(
        (oldest, chat) => (oldest && oldest.shownAt <= chat.shownAt ? oldest : chat),
        null
      )
    if (!candidate) {
      return { state, evicted: null, blocked: true }
    }
    evicted = candidate.id
    chats = chats.filter((chat) => chat.id !== evicted)
  }
  return {
    state: { chats: [...chats, { id, shownAt: now }], activeId: id },
    evicted,
    blocked: false
  }
}

export function closeOrbStripChat(state: OrbStripState, id: string): OrbStripState {
  if (id === AGENT_HUB_ORB_HOME_CHAT || !state.chats.some((chat) => chat.id === id)) {
    return state
  }
  const index = state.chats.findIndex((chat) => chat.id === id)
  const chats = state.chats.filter((chat) => chat.id !== id)
  const activeId =
    state.activeId === id
      ? (chats[Math.min(index, chats.length - 1)]?.id ?? AGENT_HUB_ORB_HOME_CHAT)
      : state.activeId
  return { chats, activeId }
}

export function activateOrbStripChat(state: OrbStripState, id: string, now: number): OrbStripState {
  if (!state.chats.some((chat) => chat.id === id)) {
    return state
  }
  return {
    chats: state.chats.map((chat) => (chat.id === id ? { ...chat, shownAt: now } : chat)),
    activeId: id
  }
}
