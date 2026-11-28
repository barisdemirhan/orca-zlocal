import { useEffect, useEffectEvent, useRef } from 'react'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import { alertKeysAvailable } from './AgentHubAlertQuickOptions'
import type { AgentHubCardControl } from './AgentHubAttentionCard'
import type { AgentHubRequestAlert as RequestAlert } from './agent-hub-alerts'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

export function AgentHubRequestAlert({
  alert,
  presentation,
  answerKeys,
  onOpen,
  onDismiss
}: {
  alert: RequestAlert
  presentation: AgentHubRequestPresentation
  answerKeys: boolean
  onOpen: () => void
  onDismiss: (id: string) => void
}): React.JSX.Element {
  const controlRef = useRef<AgentHubCardControl>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = (): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const start = (): void => {
    stop()
    timerRef.current = setTimeout(() => onDismiss(alert.id), 7000)
  }
  useEffect(() => {
    start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps -- An alert's lifetime follows its ID.
  }, [alert.id])
  const onKey = useEffectEvent((event: KeyboardEvent): void => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.repeat ||
      event.isComposing ||
      !alertKeysAvailable(event.target)
    ) {
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      onOpen()
      return
    }
    const index = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : -1
    if (index >= 0 && controlRef.current?.chooseOption(index)) {
      event.preventDefault()
    }
  })
  useEffect(() => {
    if (!answerKeys) {
      return undefined
    }
    const listener = (event: KeyboardEvent): void => onKey(event)
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [answerKeys])
  return (
    <div onMouseEnter={stop} onMouseLeave={start}>
      <AgentHubRequestCard
        item={alert}
        presentation={presentation}
        compact
        controlRef={controlRef}
        onOpen={onOpen}
        onDismiss={() => onDismiss(alert.id)}
      />
    </div>
  )
}
