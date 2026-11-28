import { useEffect, useRef } from 'react'
import { addAppKeyListener, removeAppKeyListener } from '@/lib/keyboard/app-keyboard-router'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import { useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'

const ORB_WINDOW_SELECTOR = '[data-agent-hub-orb-panel], [data-agent-hub-orb-mini-window]'
const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')

type Handlers = {
  ids: readonly string[]
  activate: (id: string) => void
  close: (id: string) => void
  newChat: () => void
}

/** Mod+N, Mod+1..8 and Mod+W act on the Orb window's chats only while focus is inside it. */
export function useAgentHubOrbWindowKeys(handlers: Handlers): void {
  const latest = useRef(handlers)
  latest.current = handlers
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
      if (!mod || event.altKey || event.shiftKey || event.isComposing) {
        return
      }
      const inside =
        event.target instanceof Element && event.target.closest(ORB_WINDOW_SELECTOR) !== null
      if (!inside || useAgentHubOrbChatStrip.getState().windowTab !== 'chat') {
        return
      }
      const { ids, activate, close, newChat } = latest.current
      const key = event.key.toLowerCase()
      const digit = /^[1-8]$/.test(key) ? Number(key) - 1 : -1
      if (key === 'n') {
        newChat()
      } else if (key === 'w') {
        const active = useAgentHubOrbChatStrip.getState().strip.activeId
        if (active !== AGENT_HUB_ORB_HOME_CHAT) {
          close(active)
        }
      } else if (digit >= 0 && ids[digit]) {
        activate(ids[digit])
      } else {
        return
      }
      // Why: the key belongs to the Orb window; Orca's own new-tab, close-tab and tab-jump keys must not also fire.
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    addAppKeyListener('keydown', onKey, { first: true })
    return () => removeAppKeyListener('keydown', onKey)
  }, [])
}
