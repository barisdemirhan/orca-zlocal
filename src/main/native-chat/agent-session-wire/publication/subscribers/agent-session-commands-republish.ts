import type { AgentSessionSubscribeEvent } from '../../../../../shared/agent-session/agent-session-wire'
import type { Subscriber } from './agent-session-subscribe-input'
import { emptyAgentSessionBatchFrame } from './agent-session-empty-batch'
import {
  subscriberCommandsChanged,
  type SubscriberFieldHooks
} from './agent-session-subscriber-frame-fields'

/** Tells every subscriber whose command catalog changed, or whose reader invalidated it, to read again. */
export function republishSubscriberCommands(port: {
  hooks: SubscriberFieldHooks
  sessionIds: Iterable<string>
  subscribers: (sessionId: string) => readonly Subscriber[]
  retired?: (sessionId: string) => boolean
  hostNow: number
  send: (subscriber: Subscriber, event: AgentSessionSubscribeEvent) => void
}): void {
  for (const sessionId of port.sessionIds) {
    for (const subscriber of port.subscribers(sessionId)) {
      const invalidated = subscriber.commandsOnRequest && port.retired?.(sessionId)
      if (invalidated || subscriberCommandsChanged(port.hooks, subscriber)) {
        port.send(
          subscriber,
          emptyAgentSessionBatchFrame(
            subscriber,
            port.hostNow,
            invalidated ? { commandsChanged: true } : {}
          )
        )
      }
    }
  }
}
