import { describe, expect, it } from 'vitest'
import { TerminalCreateParams, TerminalSplit } from './terminal-unary-params'

describe('terminal creator params compatibility', () => {
  it('accepts the caller on new hosts and strips it on the unchanged legacy object schemas', () => {
    const create = { worktree: 'id:folder', callerTerminalHandle: 'term-parent' }
    const split = { terminal: 'term-child', callerTerminalHandle: 'term-parent' }
    expect(TerminalCreateParams.parse(create).callerTerminalHandle).toBe('term-parent')
    expect(TerminalSplit.parse(split).callerTerminalHandle).toBe('term-parent')
    expect(
      TerminalCreateParams.omit({ callerTerminalHandle: true }).parse(create)
    ).not.toHaveProperty('callerTerminalHandle')
    expect(TerminalSplit.omit({ callerTerminalHandle: true }).parse(split)).not.toHaveProperty(
      'callerTerminalHandle'
    )
  })
  it('accepts old callers and treats malformed optional handles as absent', () => {
    expect(TerminalCreateParams.safeParse({ worktree: 'id:folder' }).success).toBe(true)
    expect(TerminalSplit.safeParse({ terminal: 'term-child' }).success).toBe(true)
    expect(
      TerminalCreateParams.parse({ callerTerminalHandle: 12 }).callerTerminalHandle
    ).toBeUndefined()
  })
})
