import { describe, expect, it } from 'vitest'
import { agentHubMessageSummary } from './agent-hub-message-summary'

describe('agentHubMessageSummary', () => {
  it("prefers the agent's own recap line", () => {
    const text =
      'Long report.\n\n※ recap: Mail fixed; next: review in Mailpit. (disable recaps in /config)'
    expect(agentHubMessageSummary(text)).toBe('Mail fixed; next: review in Mailpit.')
  })

  it('strips markdown and keeps whole opening sentences within the limit', () => {
    const text =
      '**Merged** T3 into `main` (`4d7401c`). A test on main is broken. It runs against the real HOME.'
    expect(agentHubMessageSummary(text, 60)).toBe(
      'Merged T3 into main (4d7401c). A test on main is broken.'
    )
  })

  it('cuts a single overlong sentence with an ellipsis', () => {
    expect(agentHubMessageSummary('a'.repeat(50), 20)).toBe(`${'a'.repeat(19)}…`)
  })
})
