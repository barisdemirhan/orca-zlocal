import type {
  AgentSessionPluginStatus,
  AgentSessionPluginSurfaceUpdate,
  AgentSessionPluginToast
} from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import type { AgentSessionSubscribeEvent } from '../../../../../shared/agent-session/agent-session-wire'
import type { Subscriber } from './agent-session-subscribe-input'
import { emptyAgentSessionBatchFrame } from './agent-session-empty-batch'
import { rememberLatestPerSession } from './structured-agent-session-activity-retention'

type PluginSurfaceDeliveryPort = {
  subscribers: (sessionId: string) => readonly Subscriber[]
  send: (subscriber: Subscriber, event: () => AgentSessionSubscribeEvent) => void
  now: () => number
}

/** Status lines are restated to a late subscriber; toasts reach only subscribers attached now. Phones get neither. */
export class AgentSessionPluginSurfaceDelivery {
  private readonly statusesBySession = new Map<string, AgentSessionPluginStatus[]>()

  constructor(private readonly port: PluginSurfaceDeliveryPort) {}

  publish(sessionId: string, update: AgentSessionPluginSurfaceUpdate): void {
    const { statuses, toast } = update
    if (statuses) {
      rememberLatestPerSession(this.statusesBySession, sessionId, statuses.length ? statuses : null)
    }
    for (const subscriber of this.port.subscribers(sessionId)) {
      this.send(subscriber, {
        ...(statuses ? { pluginStatuses: statuses } : {}),
        ...(toast ? { pluginToasts: [toast] } : {})
      })
    }
  }

  /** Restated after the opening frames; sent only when lines exist so a quiet session adds no frame before the snapshot. */
  opened(subscriber: Subscriber): void {
    const statuses = this.statusesBySession.get(subscriber.sessionId)
    if (statuses) {
      this.send(subscriber, { pluginStatuses: statuses })
    }
  }

  private send(
    subscriber: Subscriber,
    fields: {
      pluginStatuses?: AgentSessionPluginStatus[]
      pluginToasts?: AgentSessionPluginToast[]
    }
  ): void {
    if (!subscriber.boundedFrames) {
      const hostNow = this.port.now()
      this.port.send(subscriber, () => emptyAgentSessionBatchFrame(subscriber, hostNow, fields))
    }
  }
}
