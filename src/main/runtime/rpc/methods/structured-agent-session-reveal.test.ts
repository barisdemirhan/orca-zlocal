// `agentSession.reveal`: republishing a persisted chat tab through the wire boundary.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  call,
  clearStructuredHostStub,
  hostCalls,
  installStructuredHostStub,
  runtimeCalls,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-agent-session-rpc.test-fixture'

beforeEach(() => {
  installStructuredHostStub()
})

afterEach(() => {
  clearStructuredHostStub()
})

describe('agentSession.reveal', () => {
  it.each(['codex', 'claude'] as const)('republishes a persisted %s chat tab', async (agent) => {
    hostCalls.revealSession.mockResolvedValueOnce({
      sessionId: SESSION,
      workspaceId: 'workspace-1',
      agent,
      readable: true
    })

    const response = await call('agentSession.reveal', { sessionId: SESSION }, STRUCTURED_CLIENT)

    expect(hostCalls.revealSession).toHaveBeenCalledWith(SESSION)
    expect(response).toMatchObject({ ok: true, result: { ok: true, agent } })
    expect(runtimeCalls.publishStructuredAgentSessionTab).toHaveBeenCalledWith(
      expect.objectContaining({ agent, activate: true })
    )
  })

  it('publishes the workspace the host reported, not one the client could assert', async () => {
    // The client sends only a session id, so a stale or forged one cannot aim the publish at
    // another workspace.
    hostCalls.revealSession.mockResolvedValueOnce({
      sessionId: SESSION,
      workspaceId: 'workspace-from-record',
      agent: 'claude',
      readable: true
    })

    await call('agentSession.reveal', { sessionId: SESSION }, STRUCTURED_CLIENT)

    expect(runtimeCalls.publishStructuredAgentSessionTab).toHaveBeenCalledWith({
      workspaceId: 'workspace-from-record',
      sessionId: SESSION,
      agent: 'claude',
      activate: true
    })
  })

  it('publishes the tab even when the journal could not be read', async () => {
    // An unreadable chat restores to nothing, but attach still recovers it, so the tab is worth
    // publishing and the pane's hold finishes the job. Refusing here would strand it forever.
    hostCalls.revealSession.mockResolvedValueOnce({
      sessionId: SESSION,
      workspaceId: 'workspace-1',
      agent: 'codex',
      readable: false
    })

    const response = await call('agentSession.reveal', { sessionId: SESSION }, STRUCTURED_CLIENT)

    expect(response).toMatchObject({ ok: true, result: { ok: true, readable: false } })
    expect(runtimeCalls.publishStructuredAgentSessionTab).toHaveBeenCalledOnce()
  })

  it('refuses rather than throws when the host holds no such record', async () => {
    hostCalls.revealSession.mockRejectedValueOnce(new Error('agent_session_identity_required'))

    const response = await call('agentSession.reveal', { sessionId: SESSION }, STRUCTURED_CLIENT)

    expect(response).toMatchObject({
      ok: true,
      result: { ok: false, refusal: { code: 'agent_session_identity_required' } }
    })
    expect(runtimeCalls.publishStructuredAgentSessionTab).not.toHaveBeenCalled()
  })

  it('does not launder an unrelated fault into a refusal', async () => {
    hostCalls.revealSession.mockRejectedValueOnce(new Error('EACCES: journal directory'))

    const response = await call('agentSession.reveal', { sessionId: SESSION }, STRUCTURED_CLIENT)

    expect(response).toMatchObject({ ok: false })
  })

  it('is refused for a client that cannot read structured sessions', async () => {
    const response = await call(
      'agentSession.reveal',
      { sessionId: SESSION },
      { clientKind: 'runtime', clientCapabilities: [] }
    )

    expect(response).toMatchObject({ ok: false })
    expect(hostCalls.revealSession).not.toHaveBeenCalled()
  })
})
