import type { RuntimeRpcResponse } from './remote-runtime/rpc/runtime-rpc-envelope'
import type { AgentHubOrbApi } from './agent-hub-orb'
import {
  AgentHubOrbConversationSchema,
  AgentHubOrbListParamsSchema,
  AgentHubOrbOpenParamsSchema,
  AgentHubOrbSessionSchema
} from './agent-hub-orb-params'

export function createAgentHubOrbApi(
  call: (args: { method: string; params: unknown }) => Promise<RuntimeRpcResponse<unknown>>
): AgentHubOrbApi {
  const invoke = async (method: string, params: unknown): Promise<unknown> => {
    const response = await call({ method, params })
    if (!response.ok) {
      throw response.error
    }
    return response.result
  }
  return {
    open: async (params = {}) =>
      AgentHubOrbSessionSchema.parse(
        await invoke('agentHub.orb.open', AgentHubOrbOpenParamsSchema.parse(params))
      ),
    current: async () =>
      AgentHubOrbSessionSchema.nullable().parse(await invoke('agentHub.orb.current', {})),
    close: async () => {
      await invoke('agentHub.orb.close', {})
    },
    list: async (params = {}) =>
      AgentHubOrbConversationSchema.array().parse(
        await invoke('agentHub.orb.list', AgentHubOrbListParamsSchema.parse(params))
      )
  }
}

export function createDisabledAgentHubOrbApi(): AgentHubOrbApi {
  const disabled = async (): Promise<never> => {
    throw { code: 'disabled', message: 'Agent Hub Orb is unavailable to paired clients' }
  }
  return { open: disabled, current: disabled, close: disabled, list: disabled }
}
