import type { AgentJournalCursor } from '../../../../../shared/agent-session/journal/agent-session-journal-identity'
import type {
  AgentSessionJournalBatch,
  AgentSessionSubscribeEvent
} from '../../../../../shared/agent-session/agent-session-wire'
import type { Subscriber } from './agent-session-subscribe-input'

/** A batch that advances nothing: the carrier for fence, roster, and clock updates. */
export function emptyAgentSessionBatch(cursor: AgentJournalCursor): AgentSessionJournalBatch {
  return { cursor, items: [], removedItemIds: [], submissions: [] }
}

/** An empty batch frame for one subscriber carrying only `fields`. */
export function emptyAgentSessionBatchFrame(
  subscriber: Pick<Subscriber, 'sessionId' | 'cursor' | 'fence'>,
  hostNow: number,
  fields: Partial<Extract<AgentSessionSubscribeEvent, { type: 'batch' }>> = {}
): AgentSessionSubscribeEvent {
  return {
    type: 'batch',
    sessionId: subscriber.sessionId,
    batch: emptyAgentSessionBatch(subscriber.cursor),
    fence: subscriber.fence,
    hostNow,
    ...fields
  }
}
