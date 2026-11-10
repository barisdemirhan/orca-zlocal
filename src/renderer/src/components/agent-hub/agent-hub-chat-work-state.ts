import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { findAgentHubChatTab } from './agent-hub-chat-tabs'

export function agentHubChatSwitchBlockedReason(): string {
  return translate(
    'agentHub.mirror.terminalSwitchWhileWorking',
    'You can continue in the terminal when this reply finishes.'
  )
}

const subscribeNothing = (): (() => void) => () => {}

/** The chat's host is answering a turn right now, as the status feed last reported. */
export function readAgentHubChatWorking(tabId: string): boolean {
  const state = useAppStore.getState()
  const chat = findAgentHubChatTab(state, tabId)
  const target = chat
    ? structuredAgentSessionTargetForHost(structuredAgentSessionOwnerForTab(state, chat))
    : null
  return (
    !!chat &&
    !!target &&
    getStructuredAgentSessionStatusFeed(target).getSnapshot().get(chat.entityId)?.status ===
      'working'
  )
}

export function useAgentHubChatWorking(tabId: string | null): boolean {
  const owner = useAppStore((state) => {
    const chat = tabId ? findAgentHubChatTab(state, tabId) : null
    return chat ? structuredAgentSessionOwnerForTab(state, chat) : null
  })
  const feed = useMemo(() => {
    const target = owner ? structuredAgentSessionTargetForHost(owner) : null
    return target ? getStructuredAgentSessionStatusFeed(target) : null
  }, [owner])
  useEffect(() => feed?.activate(), [feed])
  return useSyncExternalStore(feed?.subscribe ?? subscribeNothing, () =>
    tabId ? readAgentHubChatWorking(tabId) : false
  )
}
