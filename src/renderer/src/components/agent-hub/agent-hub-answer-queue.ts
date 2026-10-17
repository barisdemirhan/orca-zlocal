export const ANSWER_QUEUE_TYPING_IDLE_MS = 2_000

export type AgentHubAnswerQueueEntry = {
  id: string
  arrivedAt: number
  hostId: string
  approval: boolean
}

/** Keep deferred items in place; only newly observed prompts join the tail. */
export function reconcileAgentHubAnswerQueue<T extends AgentHubAnswerQueueEntry>(
  previous: readonly T[],
  incoming: readonly T[],
  unverifiableHosts: ReadonlySet<string>,
  includeApprovals: boolean,
  answered: ReadonlySet<string>
): T[] {
  const eligible = incoming.filter(
    (item) => !answered.has(item.id) && (includeApprovals || !item.approval)
  )
  const byId = new Map(eligible.map((item) => [item.id, item]))
  const kept = previous.flatMap((item) => {
    if (answered.has(item.id) || (item.approval && !includeApprovals)) {
      return []
    }
    const current = byId.get(item.id)
    return current ? [current] : unverifiableHosts.has(item.hostId) ? [item] : []
  })
  const existing = new Set(kept.map((item) => item.id))
  return [
    ...kept,
    ...eligible.filter((item) => !existing.has(item.id)).sort((a, b) => a.arrivedAt - b.arrivedAt)
  ]
}

export function deferAgentHubAnswerQueue<T>(queue: readonly T[]): T[] {
  return queue.length > 1 ? [...queue.slice(1), ...queue.slice(0, 1)] : [...queue]
}

export function answerQueueTypingDelay(
  now: number,
  lastKeyAt: number,
  editableFocused: boolean
): number {
  return editableFocused ? Math.max(0, ANSWER_QUEUE_TYPING_IDLE_MS - (now - lastKeyAt)) : 0
}

export function isAnswerQueueEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
    ) !== null
  )
}
