import { expect, it } from 'vitest'
import { AGENT_HUB_ORB_ORIGIN } from './agent-hub-orb'
import { readAgentHubDelivery } from './rpc-contract/agent-hub-events'

it('keeps Orb identity and its Inbox source through the existing request wire while admitting legacy panes', () => {
  const event = {
    kind: 'ask',
    requestId: '984f12c0-d12d-4cba-957c-afc5ce7b3a61',
    caller: {
      kind: 'orb',
      sessionId: 'codex_orb',
      paneKey: 'orb:codex_orb',
      terminalHandle: 'orb:codex_orb',
      title: 'Orb'
    },
    target: { paneKey: 'orb:codex_orb', terminalHandle: 'orb:codex_orb' },
    question: 'Proceed?',
    options: ['Yes', 'No'],
    multi: false,
    createdAt: 1,
    expiresAt: 2
  }
  expect(AGENT_HUB_ORB_ORIGIN).toBe('agent-hub-orb')
  expect(readAgentHubDelivery({ type: 'agentHub', event })).toMatchObject({
    caller: { kind: 'orb', sessionId: 'codex_orb', title: 'Orb' }
  })
  expect(
    readAgentHubDelivery({
      type: 'agentHub',
      event: { ...event, caller: { paneKey: 'pane', terminalHandle: 'term' } }
    })
  ).toMatchObject({ caller: { paneKey: 'pane', terminalHandle: 'term' } })
})
