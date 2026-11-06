import { z } from 'zod'
import type { AgentSessionVoiceCapability } from '../../shared/agent-session-voice'
import type { CodexAppServerConnection } from './app-server/codex-app-server-connection-types'
import { isCodexAppServerRequestError } from './app-server/codex-app-server-request-error'
import { CodexAppServerUnsupportedError } from './app-server/codex-app-server-session'

const VoiceList = z.array(z.string().min(1).max(128)).max(128)
const ListVoicesResponse = z.object({
  voices: z.object({
    defaultV1: z.string().min(1).max(128),
    defaultV2: z.string().min(1).max(128),
    v1: VoiceList,
    v2: VoiceList,
    v3: VoiceList.optional()
  })
})
const confirmed = new WeakMap<object, AgentSessionVoiceCapability>()
const pending = new WeakMap<object, Promise<AgentSessionVoiceCapability>>()

/** Protocol support only. Listing voices proves no account entitlement to start audio. */
export async function readCodexRealtimeSupport(
  connection: Pick<CodexAppServerConnection, 'request'>,
  timeoutMs = 5_000
): Promise<AgentSessionVoiceCapability> {
  const known = confirmed.get(connection)
  if (known) {
    return known
  }
  const inFlight = pending.get(connection)
  if (inFlight) {
    return inFlight
  }
  const probe = (async (): Promise<AgentSessionVoiceCapability> => {
    let result: AgentSessionVoiceCapability
    try {
      const response = await connection.request(
        'thread/realtime/listVoices',
        {},
        { timeoutMs: Math.min(timeoutMs, 5_000) }
      )
      result = ListVoicesResponse.safeParse(response).success
        ? { supported: true, accountAccess: 'unchecked' }
        : {
            supported: null,
            reason: 'The Codex native voice protocol could not be verified. Try again.'
          }
    } catch (error) {
      result =
        error instanceof CodexAppServerUnsupportedError ||
        (isCodexAppServerRequestError(error) && error.code === -32601)
          ? { supported: false, reason: 'This Codex version does not support Live voice.' }
          : {
              supported: null,
              reason: 'Codex native voice support could not be checked. Try again.'
            }
    }
    if (result.supported !== null) {
      confirmed.set(connection, result)
    }
    return result
  })()
  pending.set(connection, probe)
  try {
    return await probe
  } finally {
    pending.delete(connection)
  }
}
