import { useCallback, useEffect, useMemo, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import { useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import { AGENT_HUB_ORB_NEW_TARGET } from './agent-hub-orb-side-chat'

export type AgentHubOrbQuickTarget = {
  target: string
  label: string
  options: { id: string; label: string }[]
  setTarget: (id: string) => void
  reset: () => void
}

/** Which chat the closed sphere's quick input writes to; Home chat each time it opens, nothing remembered. */
export function useAgentHubOrbQuickTarget(open: boolean): AgentHubOrbQuickTarget {
  const [target, setTarget] = useState(AGENT_HUB_ORB_HOME_CHAT)
  const chats = useAgentHubOrbChatStrip((s) => s.strip.chats)
  const meta = useAgentHubOrbChatStrip((s) => s.meta)
  const options = useMemo(
    () => [
      { id: AGENT_HUB_ORB_HOME_CHAT, label: translate('agentHub.orb.strip.home', 'Home chat') },
      ...chats
        .filter((chat) => chat.id !== AGENT_HUB_ORB_HOME_CHAT)
        .map((chat) => ({
          id: chat.id,
          label: meta[chat.id]?.title || translate('agentHub.orb.strip.newChat', 'New chat')
        })),
      { id: AGENT_HUB_ORB_NEW_TARGET, label: translate('agentHub.orb.strip.newChat', 'New chat') }
    ],
    [chats, meta]
  )
  const reset = useCallback(() => setTarget(AGENT_HUB_ORB_HOME_CHAT), [])
  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])
  const current = options.find((option) => option.id === target) ?? options[0]
  return { target: current.id, label: current.label, options, setTarget, reset }
}
