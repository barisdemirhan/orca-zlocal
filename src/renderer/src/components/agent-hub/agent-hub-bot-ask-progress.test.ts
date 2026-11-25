import { describe, expect, it } from 'vitest'
import { agentHubBotAskProgress } from './agent-hub-bot-ask-progress'

describe('agentHubBotAskProgress', () => {
  it('keeps an ask open when Send now moved the item on with lines still open', () => {
    expect(
      agentHubBotAskProgress({ phase: 'open', waiting: false, total: 3, answeredCount: 2 })
    ).toBe('partial')
  })

  it('is answered only once no line is open', () => {
    expect(
      agentHubBotAskProgress({ phase: 'answered', waiting: false, total: 3, answeredCount: 3 })
    ).toBe('answered')
  })
})
