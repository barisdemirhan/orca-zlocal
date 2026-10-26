import type { AgentHubAnswerResult } from '../../../shared/agent-hub-questions'

type Receipt = { optionIds: string[]; result: Promise<AgentHubAnswerResult> }

const MEMORY_LIMIT = 256

/** Keeps a map to its newest entries; touching a key makes it newest. */
export function remember<V>(map: Map<string, V>, key: string, value: V): void {
  map.delete(key)
  map.set(key, value)
  const oldest = map.keys().next()
  if (map.size > MEMORY_LIMIT && !oldest.done) {
    map.delete(oldest.value)
  }
}

function sameOptions(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

/** Answers each question at most once: a retry replays the first result, another choice is refused. */
export class AgentHubAnswerReceipts {
  private readonly receipts = new Map<string, Receipt>()

  once(
    questionId: string,
    optionIds: string[],
    run: () => Promise<AgentHubAnswerResult>
  ): Promise<AgentHubAnswerResult> {
    const prior = this.receipts.get(questionId)
    if (prior) {
      if (!sameOptions(prior.optionIds, optionIds)) {
        return Promise.resolve({
          outcome: 'refused',
          questionId,
          reason: 'already_answered',
          answeredOptionIds: prior.optionIds
        })
      }
      return prior.result.then((result) =>
        result.outcome === 'answered' ? { ...result, replayed: true } : result
      )
    }
    const result = run()
    const receipt = { optionIds, result }
    remember(this.receipts, questionId, receipt)
    // A refusal wrote nothing, so the same question may be answered again.
    const forget = (): void => {
      if (this.receipts.get(questionId) === receipt) {
        this.receipts.delete(questionId)
      }
    }
    void result.then((settled) => {
      if (settled.outcome === 'refused') {
        forget()
      }
    }, forget)
    return result
  }
}
