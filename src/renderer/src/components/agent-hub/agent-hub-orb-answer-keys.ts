import { useEffect, useEffectEvent, useRef } from 'react'
import { alertKeysAvailable } from './AgentHubAlertQuickOptions'
import { AGENT_HUB_CARD_KEY_GUARD_MS } from './use-agent-hub-quick-answer'

export function useAgentHubOrbAnswerKeys(choose: (key: string) => boolean): void {
  const shownAt = useRef(0)
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.repeat ||
      event.isComposing ||
      !alertKeysAvailable(event.target) ||
      Date.now() - shownAt.current < AGENT_HUB_CARD_KEY_GUARD_MS
    ) {
      return
    }
    if (choose(event.key)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  })
  useEffect(() => {
    shownAt.current = Date.now()
    const listener = (event: KeyboardEvent): void => onKey(event)
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [])
}
