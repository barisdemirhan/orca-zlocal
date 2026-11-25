import { describe, expect, it } from 'vitest'
import {
  EMPTY_ORB_STRIP,
  openOrbStripChat,
  type OrbStripChatStatus,
  type OrbStripState
} from './agent-hub-orb-chat-strip'

describe('openOrbStripChat', () => {
  const full: OrbStripState = {
    chats: [
      { id: 'home', shownAt: 0 },
      { id: 'a', shownAt: 5 },
      { id: 'b', shownAt: 9 }
    ],
    activeId: 'b'
  }

  it('drops the longest-idle side chat and never a busy one or Home', () => {
    const status = (id: string): OrbStripChatStatus => (id === 'a' ? 'working' : 'idle')
    const result = openOrbStripChat(full, 'c', 3, status, 20)
    expect(result.evicted).toBe('b')
    expect(result.state.chats.map((chat) => chat.id)).toEqual(['home', 'a', 'c'])
    expect(result.state.activeId).toBe('c')
  })

  it('blocks instead of losing a busy chat when none is idle', () => {
    const result = openOrbStripChat(full, 'c', 3, () => 'attention', 20)
    expect(result.blocked).toBe(true)
    expect(result.state).toBe(full)
    expect(openOrbStripChat(EMPTY_ORB_STRIP, 'x', 1, () => 'idle', 1).blocked).toBe(true)
  })
})
