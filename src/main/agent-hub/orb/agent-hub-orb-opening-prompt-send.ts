import { randomUUID } from 'node:crypto'
import {
  structuredAgentSessionMessageSendMutation,
  structuredAgentSessionSendBody
} from '../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import { createStructuredAgentSessionOperationId } from '../../../shared/agent-session/lifecycle/operations/structured-agent-session-mutation'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { StructuredAgentSessionCaller } from '../../native-chat/agent-session-wire/host/structured-agent-session-host-types'

/** Return an id only for a proven journal commit, reconciling throws after append to avoid a duplicate turn.
 *  Upstream's create-time firstMessage cannot reach a chat that already exists, so the Orb keeps this send. */
export async function sendAgentHubOrbOpeningPrompt(args: {
  host: StructuredAgentSessionHost
  caller: StructuredAgentSessionCaller
  sessionId: string
  fence: number
  text: string
}): Promise<string | null> {
  const clientMessageId = createStructuredAgentSessionOperationId(randomUUID)
  try {
    const result = await args.host.send(args.caller, {
      ...structuredAgentSessionMessageSendMutation({
        sessionId: args.sessionId,
        clientOperationId: clientMessageId,
        expectedRuntimeFence: args.fence,
        body: structuredAgentSessionSendBody(args.text, [])
      }),
      personsMessage: true
    })
    return result.ok ? result.value.clientMessageId : null
  } catch (error) {
    // Settlement can fail after append; reconcile the journal before reporting a failure.
    try {
      const committed = await (
        await args.host.attentionReads.journal(args.sessionId)
      ).submission(clientMessageId)
      if (committed) {
        return clientMessageId
      }
    } catch {
      // The host may have gone away before the snapshot.
    }
    args.host.deps.logger.warn("sending the Orb's opening prompt failed", {
      scope: 'agent-hub-orb',
      sessionId: args.sessionId,
      error
    })
    return null
  }
}
