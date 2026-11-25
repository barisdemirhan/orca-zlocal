import { describe, expect, it } from 'vitest'
import {
  mergeAgentHubInboxDuplicates,
  type AgentHubInboxEntry,
  type AgentHubInboxSource
} from './agent-hub-inbox-groups'

function ask(
  id: string,
  source: AgentHubInboxSource,
  questionKeys: string[],
  since: number | null
): AgentHubInboxEntry<null> {
  return {
    id,
    senderKey: 'scotty',
    side: 'bots',
    kind: 'ask',
    since,
    source,
    questionKeys,
    payload: null
  }
}

describe('mergeAgentHubInboxDuplicates', () => {
  it('lets the work record win over the chat copy and keeps the earliest wait', () => {
    const merged = mergeAgentHubInboxDuplicates([
      ask('chat', 'chat', ['chat:s1', 'text:ship it?'], 200),
      ask('item', 'item', ['id:e5', 'text:ship it?', 'chat:s1'], 100)
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ id: 'item', since: 100 })
  })

  it('merges a request with the chat copy of the same words', () => {
    const merged = mergeAgentHubInboxDuplicates([
      ask('chat', 'chat', ['text:ok?'], 5),
      ask('req', 'request', ['text:ok?'], 9)
    ])
    expect(merged).toMatchObject([{ id: 'req', since: 5 }])
  })

  it('keeps two different questions of one chat as two rows', () => {
    const merged = mergeAgentHubInboxDuplicates([
      ask('item1', 'item', ['id:e1', 'text:first?', 'chat:s1'], 1),
      ask('item2', 'item', ['id:e2', 'text:second?', 'chat:s1'], 2),
      ask('chat', 'chat', ['chat:s1', 'text:second?'], 3)
    ])
    expect(merged.map((entry) => entry.id)).toEqual(['item1', 'item2'])
  })

  it('joins by session only when a copy has no words', () => {
    expect(
      mergeAgentHubInboxDuplicates([
        ask('item', 'item', ['id:e1', 'text:q', 'chat:s1'], 1),
        ask('chat', 'chat', ['chat:s1'], 2)
      ])
    ).toHaveLength(1)
  })

  it('never merges asks without keys, or across senders', () => {
    expect(
      mergeAgentHubInboxDuplicates([ask('a', 'item', [], 1), ask('b', 'item', [], 2)])
    ).toHaveLength(2)
    const other = { ...ask('c', 'chat', ['id:e1'], 3), senderKey: 'other' }
    expect(mergeAgentHubInboxDuplicates([ask('a', 'item', ['id:e1'], 1), other])).toHaveLength(2)
  })
})
