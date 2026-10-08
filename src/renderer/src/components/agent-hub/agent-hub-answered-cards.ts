/** How long a reopened card keeps showing an answer still on its way, before it can be retried. */
export const AGENT_HUB_ANSWER_HOLD_MS = 10_000
const LIMIT = 64

// Why module scope: the hub's cards unmount on paging and closing while their answer is still
// being typed, and a remounted card must not offer the same prompt a second time.
const answered = new Map<string, { choice: number; at: number }>()

export function agentHubCardKey(paneKey: string, stateSince: number): string {
  return `${paneKey}:${stateSince}`
}

export function readAnsweredAgentHubCard(key: string, now = Date.now()): number | null {
  const entry = answered.get(key)
  if (!entry || now - entry.at >= AGENT_HUB_ANSWER_HOLD_MS) {
    answered.delete(key)
    return null
  }
  return entry.choice
}

export function recordAgentHubCardAnswer(key: string, choice: number | null): void {
  answered.delete(key)
  if (choice === null) {
    return
  }
  answered.set(key, { choice, at: Date.now() })
  if (answered.size > LIMIT) {
    const oldest = answered.keys().next().value
    if (oldest !== undefined) {
      answered.delete(oldest)
    }
  }
}

export function resetAgentHubAnsweredCardsForTest(): void {
  answered.clear()
}
