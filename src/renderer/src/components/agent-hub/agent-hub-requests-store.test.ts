import type { AgentHubRequest } from '../../../../shared/agent-hub-requests'
import { describe, expect, it } from 'vitest'
import {
  reduceAgentHubRequests,
  agentHubInboxRequests,
  type AgentHubRequestsState
} from './agent-hub-requests-store'
import { agentHubRequestBase } from './agent-hub-request-test-fixtures'

const base = agentHubRequestBase()
const ask: Extract<AgentHubRequest, { kind: 'ask' }> = {
  ...base,
  kind: 'ask',
  question: 'Go?',
  options: ['Yes', 'No'],
  multi: false
}
const consent: Extract<AgentHubRequest, { kind: 'consent' }> = {
  ...base,
  requestId: 'consent',
  kind: 'consent',
  operation: { kind: 'mirror', action: 'close' }
}
const notify: Extract<AgentHubRequest, { kind: 'notify' }> = {
  ...base,
  requestId: 'notify',
  kind: 'notify',
  text: 'Ready',
  level: 'done',
  sound: false,
  links: []
}

describe('Agent Hub request projection', () => {
  it('restores asks, consents, notifications and per-pane progress then applies live closure and clear', () => {
    const state = reduceAgentHubRequests(new Map(), 'local', {
      kind: 'snapshot',
      snapshot: {
        requests: [ask, consent, notify],
        progress: [{ ...base, kind: 'progress', text: 'Building' }]
      }
    })
    expect(state.get('local')?.pendingAsks.get(base.requestId)?.question).toBe('Go?')
    expect(state.get('local')?.pendingConsents.get('consent')?.operation).toEqual({
      kind: 'mirror',
      action: 'close'
    })
    expect(state.get('local')?.notifications.get('notify')?.text).toBe('Ready')
    expect(state.get('local')?.progressByPane.get(base.target.paneKey)?.text).toBe('Building')
    const closed = reduceAgentHubRequests(state, 'local', {
      ...consent,
      kind: 'closed',
      reason: 'responded'
    })
    expect(closed.get('local')?.pendingConsents.size).toBe(0)
    expect(closed.get('local')?.pendingAsks.size).toBe(1)
    const cleared = reduceAgentHubRequests(closed, 'local', {
      ...base,
      kind: 'progress',
      text: null
    })
    expect(cleared.get('local')?.progressByPane.size).toBe(0)
  })

  it('keeps equal request and pane IDs on paired hosts separate and replaces only the replayed host', () => {
    let state: AgentHubRequestsState = new Map()
    for (const host of ['local', 'workhost']) {
      state = reduceAgentHubRequests(state, host, { ...ask, options: [...ask.options] })
      state = reduceAgentHubRequests(state, host, { ...base, kind: 'progress', text: host })
    }
    state = reduceAgentHubRequests(state, 'workhost', {
      kind: 'snapshot',
      snapshot: { requests: [], progress: [] }
    })
    expect(state.get('workhost')?.pendingAsks.size).toBe(0)
    expect(state.get('workhost')?.progressByPane.size).toBe(0)
    expect(state.get('local')?.pendingAsks.size).toBe(1)
    expect(state.get('local')?.progressByPane.get(base.target.paneKey)?.text).toBe('local')
    state = reduceAgentHubRequests(state, 'workhost', { ...ask, options: [...ask.options] })
    state = reduceAgentHubRequests(state, 'workhost', { ...base, kind: 'closed', reason: 'timeout' })
    expect(state.get('workhost')?.pendingAsks.size).toBe(0)
    expect(state.get('local')?.pendingAsks.size).toBe(1)
  })

  it('does not remove a newer progress request when an older request closes', () => {
    let state = reduceAgentHubRequests(new Map(), 'local', {
      ...base,
      kind: 'progress',
      text: 'Old'
    })
    state = reduceAgentHubRequests(state, 'local', {
      ...base,
      requestId: 'new',
      kind: 'progress',
      text: 'New'
    })
    state = reduceAgentHubRequests(state, 'local', { ...base, kind: 'closed', reason: 'responded' })
    expect(state.get('local')?.progressByPane.get(base.target.paneKey)?.text).toBe('New')
  })

  it('keeps away decisions across snapshot replay and preserves only in-flight answers still pending', () => {
    let state = reduceAgentHubRequests(new Map(), 'workhost', ask)
    state = reduceAgentHubRequests(state, 'workhost', {
      ...ask,
      requestId: 'away',
      kind: 'closed',
      reason: 'responded',
      result: { answer: 'Yes', index: 1, by: 'away-default', desktop: 'host' }
    })
    const view = state.get('workhost')
    if (!view) {
      throw new Error('host projection missing')
    }
    const sending = { phase: 'sending' as const }
    state = new Map(state).set('workhost', {
      ...view,
      answerStates: new Map([
        [ask.requestId, sending],
        ['gone', sending]
      ])
    })
    state = reduceAgentHubRequests(state, 'workhost', {
      kind: 'snapshot',
      snapshot: { requests: [ask], progress: [] }
    })
    expect(state.get('workhost')?.awayAnswers.get('away')?.result.answer).toBe('Yes')
    expect(state.get('workhost')?.answerStates.get(ask.requestId)).toBe(sending)
    expect(state.get('workhost')?.answerStates.has('gone')).toBe(false)
  })

  it('keeps only needs-you notifications in Inbox and removes expired notifications on their own host', () => {
    let state: AgentHubRequestsState = new Map()
    for (const host of ['local', 'workhost']) {
      for (const level of ['info', 'done', 'needs-you'] as const) {
        state = reduceAgentHubRequests(state, host, { ...notify, requestId: level, level })
      }
    }
    expect(agentHubInboxRequests(state).map((item) => [item.host, item.request.requestId])).toEqual(
      [
        ['local', 'needs-you'],
        ['workhost', 'needs-you']
      ]
    )
    for (const level of ['info', 'done', 'needs-you']) {
      state = reduceAgentHubRequests(state, 'workhost', {
        ...notify,
        requestId: level,
        kind: 'closed',
        reason: 'timeout'
      })
    }
    expect(state.get('workhost')?.notifications.size).toBe(0)
    expect(state.get('local')?.notifications.size).toBe(3)
    expect(agentHubInboxRequests(state)).toHaveLength(1)
  })
})
