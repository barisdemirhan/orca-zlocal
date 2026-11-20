import { describe, expect, it } from 'vitest'
import { AgentHookServer } from './server/agent-hook-server'

const PANE = 'coordinator:11111111-1111-4111-8111-111111111111'
const WORKER = 'worker:22222222-2222-4222-8222-222222222222'

describe('pane model ownership', () => {
  it('accepts a model update from a pane status that omits the agent type', () => {
    const server = new AgentHookServer()
    server.ingestTerminalStatus({
      paneKey: PANE,
      payload: {
        state: 'working',
        prompt: 'coordinate',
        agentType: 'claude',
        model: 'claude-opus-5-5'
      }
    })
    server.ingestTerminalStatus({
      paneKey: PANE,
      payload: { state: 'working', prompt: 'coordinate', model: 'claude-sonnet-5-5' }
    })
    expect(server.getStatusSnapshotForPane(PANE)[0]?.model).toBe('claude-sonnet-5-5')
  })

  it.each([undefined, 'claude-opus-5-5'])(
    'keeps the coordinator model %s when a nested worker reports its model',
    (model) => {
      const server = new AgentHookServer()
      server.ingestTerminalStatus({
        paneKey: PANE,
        payload: { state: 'working', prompt: 'coordinate', agentType: 'claude', model }
      })
      server.ingestTerminalStatus({
        paneKey: PANE,
        payload: { state: 'working', prompt: 'worker', agentType: 'codex', model: 'gpt-6.1-sol' }
      })
      server.ingestTerminalStatus({
        paneKey: WORKER,
        payload: { state: 'working', prompt: 'worker', agentType: 'codex', model: 'gpt-6.1-sol' }
      })
      expect(server.getStatusSnapshotForPane(PANE)[0]?.agentType).toBe('claude')
      expect(server.getStatusSnapshotForPane(PANE)[0]?.model).toBe(model)
      expect(server.getStatusSnapshotForPane(WORKER)[0]?.model).toBe('gpt-6.1-sol')
    }
  )
})
