import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from '../../orca-runtime'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import { AGENT_HUB_ORB_METHODS } from './agent-hub-orb'
import { STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY } from '../../../../shared/agent-session/capabilities/agent-session-runtime-capabilities'

let runtime: OrcaRuntimeService

beforeEach(() => {
  runtime = new OrcaRuntimeService()
  vi.spyOn(runtime.agentHubOrb, 'requireEnabled').mockImplementation(() => {
    throw new AgentHubError('disabled', 'Agent Hub Orb is disabled')
  })
  vi.spyOn(runtime.agentHubOrb, 'close').mockResolvedValue(undefined)
})

afterEach(() => {
  runtime.agentHub.dispose()
  vi.restoreAllMocks()
})

it('lets an authorized desktop close Orb after Agent control has been disabled', async () => {
  await expect(AGENT_HUB_ORB_METHODS[0].handler(undefined, { runtime })).resolves.toBeNull()
  expect(runtime.agentHubOrb.close).toHaveBeenCalledOnce()
  expect(runtime.agentHubOrb.requireEnabled).not.toHaveBeenCalled()
  expect(() => AGENT_HUB_ORB_METHODS[1].handler({}, { runtime })).toThrow(
    expect.objectContaining({ code: 'disabled' })
  )
})

it.each(['paired-device', 'mobile', 'incapable'] as const)(
  'keeps close unavailable to a %s client even when Orb is disabled',
  async (kind) => {
    const context = {
      runtime,
      ...(kind === 'paired-device'
        ? { caller: { kind: 'paired-device' as const, deviceId: 'phone' } }
        : {}),
      clientKind: kind === 'mobile' ? ('mobile' as const) : ('runtime' as const),
      clientCapabilities: kind === 'incapable' ? [] : [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY]
    }
    await expect(AGENT_HUB_ORB_METHODS[0].handler(undefined, context)).rejects.toMatchObject(
      kind === 'incapable'
        ? { refusal: { code: 'structured_agent_session_unsupported' } }
        : { code: 'disabled' }
    )
    expect(runtime.agentHubOrb.close).not.toHaveBeenCalled()
  }
)
