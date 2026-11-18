import { describe, expect, it } from 'vitest'
import {
  answerQueueTypingDelay,
  deferAgentHubAnswerQueue,
  reconcileAgentHubAnswerQueue,
  type AgentHubAnswerQueueEntry
} from './agent-hub-answer-queue'

const first: AgentHubAnswerQueueEntry = {
  id: 'first',
  arrivedAt: 10,
  hostId: 'local',
  approval: false
}
const second: AgentHubAnswerQueueEntry = {
  id: 'second',
  arrivedAt: 20,
  hostId: 'ssh:workhost',
  approval: false
}
const third: AgentHubAnswerQueueEntry = {
  id: 'third',
  arrivedAt: 5,
  hostId: 'local',
  approval: false
}
const reconcile = (
  previous: readonly AgentHubAnswerQueueEntry[],
  incoming: readonly AgentHubAnswerQueueEntry[],
  unverifiable: ReadonlySet<string> = new Set(),
  approvals = false,
  answered: ReadonlySet<string> = new Set()
) => reconcileAgentHubAnswerQueue(previous, incoming, unverifiable, approvals, answered)

describe('answer queue ordering and evidence', () => {
  it('starts in arrival order, preserves Later, and appends newly observed older prompts', () => {
    const initial = reconcile([], [second, first])
    expect(initial.map((item) => item.id)).toEqual(['first', 'second'])
    const deferred = deferAgentHubAnswerQueue(initial)
    expect(reconcile(deferred, [third, second, first]).map((item) => item.id)).toEqual([
      'second',
      'first',
      'third'
    ])
  })

  it('removes resolved and stopped prompts while retaining an unverifiable host', () => {
    expect(reconcile([first, second], [], new Set(['ssh:workhost']))).toEqual([second])
    expect(
      reconcile(
        [first, second],
        [first, second],
        new Set(['ssh:workhost']),
        false,
        new Set(['second'])
      )
    ).toEqual([first])
  })

  it('includes approvals only after opting in and removes them when opted out again', () => {
    const approval = { ...first, id: 'approval', approval: true }
    expect(reconcile([], [approval, second])).toEqual([second])
    expect(reconcile([], [approval, second], new Set(), true)).toEqual([approval, second])
    expect(reconcile([approval, second], [approval, second], new Set(['local']))).toEqual([second])
  })
})

it('waits for two seconds without typing only while an editable element is focused', () => {
  expect(answerQueueTypingDelay(1500, 1000, true)).toBe(1500)
  expect(answerQueueTypingDelay(2999, 1000, true)).toBe(1)
  expect(answerQueueTypingDelay(3000, 1000, true)).toBe(0)
  expect(answerQueueTypingDelay(1500, 1000, false)).toBe(0)
})
