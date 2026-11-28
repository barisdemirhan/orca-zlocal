import { describe, expect, it } from 'vitest'
import { botQuestionTextKey, mergeBotAlerts, type BotAlertFacet } from './agent-hub-bot-alert-merge'

const facet = (over: Partial<BotAlertFacet> & Pick<BotAlertFacet, 'id'>): BotAlertFacet => ({
  botKey: 'scotty',
  kind: 'ask',
  source: 'item',
  questionKeys: [],
  ...over
})

describe('mergeBotAlerts', () => {
  it('shows a question that arrives from the chat and the work record once, answered through the record', () => {
    const [group] = mergeBotAlerts([
      facet({ id: 'chat', source: 'chat', questionKeys: [botQuestionTextKey('Which  language?')] }),
      facet({
        id: 'item',
        questionKeys: ['id:e41', botQuestionTextKey('which language?')]
      })
    ])
    expect(group?.lead.id).toBe('item')
    expect(group?.distinct).toHaveLength(1)
    expect(group?.ids.toSorted()).toEqual(['chat', 'item'])
  })

  it('keeps two different questions of one bot as two updates led by the newest', () => {
    const [group] = mergeBotAlerts([
      facet({ id: 'a', questionKeys: ['id:e1'] }),
      facet({ id: 'b', questionKeys: ['id:e2'] })
    ])
    expect(group?.distinct).toHaveLength(2)
    expect(group?.lead.id).toBe('b')
  })

  it('leads with the open question over a newer result and never folds across bots', () => {
    const groups = mergeBotAlerts([
      facet({ id: 'ask', questionKeys: ['id:e1'] }),
      facet({ id: 'done', kind: 'result' }),
      facet({ id: 'other', botKey: 'worf', questionKeys: ['id:e1'] })
    ])
    expect(groups.map((group) => group.botKey)).toEqual(['scotty', 'worf'])
    expect(groups[0]?.lead.id).toBe('ask')
    expect([groups[0]?.open, groups[0]?.results]).toEqual([1, 1])
  })

  it('folds a chat ask into the work record through the chat session, whatever the wording', () => {
    const groups = mergeBotAlerts([
      facet({ id: 'chat', source: 'chat', questionKeys: ['chat:s1', botQuestionTextKey('Go?')] }),
      facet({
        id: 'item',
        questionKeys: ['id:e1', 'chat:s1', botQuestionTextKey('Shall I go on?')]
      })
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.distinct).toHaveLength(1)
    expect(groups[0]?.lead.id).toBe('item')
  })

  it('shows an automation chat that ends and its run record as one bubble led by the run', () => {
    const [group] = mergeBotAlerts([
      facet({ id: 'chat', kind: 'result', source: 'chat', questionKeys: ['chat:s9'] }),
      facet({ id: 'run', kind: 'result', source: 'event', questionKeys: ['chat:s9'] })
    ])
    expect(group?.distinct).toHaveLength(1)
    expect(group?.lead.id).toBe('run')
  })
})
