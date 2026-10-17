import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import {
  answerQueueTypingDelay,
  deferAgentHubAnswerQueue,
  isAnswerQueueEditable,
  reconcileAgentHubAnswerQueue
} from './agent-hub-answer-queue'
import type { AgentHubAnswerQueueItem } from './agent-hub-answer-queue-source'
import {
  closeAgentHubAnswerQueue,
  openAgentHubAnswerQueue,
  updateAgentHubAnswerQueuePresence,
  useAgentHubAnswerQueueState
} from './agent-hub-answer-queue-store'
import { registerAgentHubAnswerQueueCommand } from './agent-hub-commands'

export function useAgentHubAnswerQueueController({
  enabled,
  automatically,
  includeApprovals,
  source,
  unverifiableHosts,
  verifiableHosts
}: {
  enabled: boolean
  automatically: boolean
  includeApprovals: boolean
  source: readonly AgentHubAnswerQueueItem[]
  unverifiableHosts: ReadonlySet<string>
  verifiableHosts: ReadonlySet<string>
}) {
  const [queue, setQueue] = useState<AgentHubAnswerQueueItem[]>([])
  const [completed, setCompleted] = useState(0)
  const [revision, setRevision] = useState(0)
  const answered = useRef(new Set<string>())
  const sentHere = useRef(new Set<string>())
  const notified = useRef(new Set<string>())
  const previous = useRef(queue)
  const autoPending = useRef(false)
  const lastKeyAt = useRef(Number.NEGATIVE_INFINITY)
  const open = useAgentHubAnswerQueueState((state) => state.open)
  const wasOpen = useRef(false)

  const resolved = useCallback((id: string) => {
    if (answered.current.has(id)) {
      return
    }
    answered.current.add(id)
    setRevision((value) => value + 1)
  }, [])
  const markSending = useCallback((id: string, sending = true) => {
    if (sending) {
      sentHere.current.add(id)
    } else {
      sentHere.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const next = enabled
      ? reconcileAgentHubAnswerQueue(
          previous.current,
          source,
          new Set([
            ...unverifiableHosts,
            ...previous.current
              .filter((item) => !verifiableHosts.has(item.hostId))
              .map((item) => item.hostId)
          ]),
          includeApprovals,
          answered.current
        )
      : []
    const remaining = new Set(next.map((item) => item.id))
    const removed = previous.current.filter((item) => !remaining.has(item.id))
    for (const item of removed) {
      if (
        enabled &&
        (includeApprovals || !item.approval) &&
        !sentHere.current.has(item.id) &&
        !notified.current.has(item.id)
      ) {
        notified.current.add(item.id)
        toast(translate('agentHub.answerQueue.answeredElsewhere', 'Answered elsewhere'), {
          duration: 1500
        })
      }
    }
    if (enabled && previous.current.length === 0 && next.length > 0) {
      autoPending.current = true
    }
    if (next.length === 0) {
      autoPending.current = false
    }
    previous.current = next
    setQueue(next)
    if (removed.length > 0 && open) {
      setCompleted((value) => value + removed.length)
    }
    updateAgentHubAnswerQueuePresence(enabled, next.length)
  }, [enabled, includeApprovals, source, unverifiableHosts, verifiableHosts, revision, open])

  useEffect(() => {
    if (open && !wasOpen.current) {
      setCompleted(0)
      autoPending.current = false
    }
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!enabled) {
      return
    }
    const keydown = (event: KeyboardEvent): void => {
      if (isAnswerQueueEditable(event.target)) {
        lastKeyAt.current = Date.now()
        if (autoPending.current) {
          setRevision((value) => value + 1)
        }
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !automatically || open || !autoPending.current || queue.length === 0) {
      return
    }
    const attempt = (): void => {
      const delay = answerQueueTypingDelay(
        Date.now(),
        lastKeyAt.current,
        isAnswerQueueEditable(document.activeElement)
      )
      if (delay > 0) {
        timer = setTimeout(attempt, delay)
      } else {
        autoPending.current = false
        openAgentHubAnswerQueue()
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    attempt()
    return () => clearTimeout(timer)
  }, [enabled, automatically, open, queue.length, revision])

  useEffect(() => {
    if (!open || queue.length !== 0) {
      return
    }
    const timer = setTimeout(closeAgentHubAnswerQueue, 1200)
    return () => clearTimeout(timer)
  }, [open, queue.length])

  useEffect(
    () => registerAgentHubAnswerQueueCommand(enabled ? openAgentHubAnswerQueue : null),
    [enabled]
  )
  useEffect(() => () => updateAgentHubAnswerQueuePresence(false, 0), [])

  return {
    queue,
    completed,
    open,
    resolved,
    markSending,
    close: () => {
      autoPending.current = false
      closeAgentHubAnswerQueue()
    },
    later: () => {
      const next = deferAgentHubAnswerQueue(previous.current)
      previous.current = next
      setQueue(next)
    }
  }
}
