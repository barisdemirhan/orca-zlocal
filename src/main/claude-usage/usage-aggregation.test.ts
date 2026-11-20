import { describe, expect, it } from 'vitest'
import { parseClaudeUsageRecord } from './transcript-record-parser'
import { aggregateClaudeUsage, mergeClaudeSessions } from './usage-aggregation'
import type { ClaudeUsageAttributedTurn, ClaudeUsageSession } from './types'

function turn(model: string, hour: number, isSidechain?: boolean): ClaudeUsageAttributedTurn {
  const parsed = parseClaudeUsageRecord(
    JSON.stringify({
      type: 'assistant',
      sessionId: 'parent',
      timestamp: `2026-10-13T${hour}:00:00.000Z`,
      ...(isSidechain !== undefined ? { isSidechain } : {}),
      message: { model, usage: { input_tokens: 100, output_tokens: 20 } }
    })
  )
  if (!parsed) {
    throw new Error('Fixture did not parse')
  }
  return {
    ...parsed,
    day: '2026-10-13',
    projectKey: 'cwd:/repo',
    projectLabel: 'repo',
    repoId: null,
    worktreeId: null
  }
}

const main = turn('claude-opus-5-5', 12)
const olderMain = turn('claude-sonnet-5-5', 10, false)
const child = turn('claude-haiku-5-5', 14, true)

describe('Claude session model ownership', () => {
  it.each([
    [olderMain, main, child],
    [child, main, olderMain]
  ])('selects the latest main-chain model regardless of turn order', (...turns) => {
    const result = aggregateClaudeUsage(turns)
    expect(result.sessions[0]?.model).toBe('claude-opus-5-5')
    expect(result.sessions[0]?.turnCount).toBe(3)
    expect(result.sessions[0]?.totalInputTokens).toBe(300)
    expect(result.dailyAggregates.map((entry) => entry.model).sort()).toEqual([
      'claude-haiku-5-5',
      'claude-opus-5-5',
      'claude-sonnet-5-5'
    ])
  })

  it.each([
    [main, child],
    [child, main]
  ])('keeps main-chain priority when per-file persisted sessions merge', (...turns) => {
    const sessions = new Map<string, ClaudeUsageSession>()
    for (const entry of turns) {
      mergeClaudeSessions(sessions, aggregateClaudeUsage([entry]).sessions)
    }
    expect(sessions.get('parent')?.model).toBe('claude-opus-5-5')
    expect(sessions.get('parent')?.turnCount).toBe(2)
  })

  it('falls back to the latest sidechain only when there are no main-chain turns', () => {
    expect(
      aggregateClaudeUsage([child, turn('claude-sonnet-5-5', 13, true)]).sessions[0]?.model
    ).toBe('claude-haiku-5-5')
  })

  it('does not use a sidechain model when a main-chain turn has no model', () => {
    expect(aggregateClaudeUsage([child, { ...main, model: null }]).sessions[0]?.model).toBeNull()
  })

  it('treats old persisted sessions without chain metadata as main-chain evidence', () => {
    const legacy = aggregateClaudeUsage([main]).sessions[0]
    const { modelIsSidechain: _chain, modelTimestamp: _timestamp, ...oldSession } = legacy
    const sessions = new Map<string, ClaudeUsageSession>([['parent', oldSession]])
    mergeClaudeSessions(sessions, aggregateClaudeUsage([child]).sessions)
    expect(sessions.get('parent')?.model).toBe('claude-opus-5-5')
  })
})
