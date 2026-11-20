import { delayUnlessAborted } from '../../../shared/concurrency/abort-aware-delay'
import type { AgentHubAnswerEvidence } from '../../../shared/agent-hub-questions'
import type { AgentStatusIpcPayload } from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import { hookRowAgentPhase } from '../../../shared/agent-status/lifecycle/agent-transitions'

const VERIFY_POLL_MS = 100

/** Watches the pane's hook row after a written answer: did the prompt leave, did the agent resume. */
export async function watchAnswerEvidence(
  readHookRow: (paneKey: string) => AgentStatusIpcPayload | null,
  paneKey: string,
  watch: {
    askedAt: number | null
    /** The row Orca wrote itself when clearing the answered wait; only later rows are evidence. */
    markedAt: number | null
    verifyMs: number
    signal: AbortSignal
  }
): Promise<AgentHubAnswerEvidence> {
  const { askedAt, markedAt, verifyMs, signal } = watch
  if (verifyMs <= 0) {
    return { accepted: true, delivered: null, agentContinued: null }
  }
  const deadline = Date.now() + verifyMs
  let delivered = false
  while (!signal.aborted) {
    const row = readHookRow(paneKey)
    if (!row || markedAt === null || row.receivedAt > markedAt) {
      const phase = row ? hookRowAgentPhase(row) : 'rest'
      delivered ||= phase !== 'needs-you' || row?.stateStartedAt !== askedAt
      if (phase === 'working') {
        return { accepted: true, delivered: true, agentContinued: true }
      }
    }
    if (Date.now() >= deadline) {
      break
    }
    await delayUnlessAborted(VERIFY_POLL_MS, signal)
  }
  return { accepted: true, delivered, agentContinued: null }
}
