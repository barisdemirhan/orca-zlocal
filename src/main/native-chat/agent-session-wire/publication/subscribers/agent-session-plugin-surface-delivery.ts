import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
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

type PluginSurfaceFields = {
  pluginStatuses?: AgentSessionPluginStatus[]
  pluginToasts?: AgentSessionPluginToast[]
  pluginPromptHint?: AgentSessionPluginNode | null
  pluginPane?: AgentSessionPluginPane | null
}

/** Status lines and drawn trees are restated to a late subscriber; toasts reach only subscribers attached now. Phones get none. */
export class AgentSessionPluginSurfaceDelivery {
  private readonly statusesBySession = new Map<string, AgentSessionPluginStatus[]>()
  private readonly promptHintBySession = new Map<string, AgentSessionPluginNode>()
  private readonly paneBySession = new Map<string, AgentSessionPluginPane>()

  constructor(private readonly port: PluginSurfaceDeliveryPort) {}

  publish(sessionId: string, update: AgentSessionPluginSurfaceUpdate): void {
    const { statuses, toast, promptHint, pane } = update
    if (statuses) {
      rememberLatestPerSession(this.statusesBySession, sessionId, statuses.length ? statuses : null)
    }
    rememberLatestPerSession(this.promptHintBySession, sessionId, promptHint)
    rememberLatestPerSession(this.paneBySession, sessionId, pane)
    for (const subscriber of this.port.subscribers(sessionId)) {
      this.send(subscriber, {
        ...(statuses ? { pluginStatuses: statuses } : {}),
        ...(toast ? { pluginToasts: [toast] } : {}),
        ...(promptHint !== undefined ? { pluginPromptHint: promptHint } : {}),
        ...(pane !== undefined ? { pluginPane: pane } : {})
      })
    }
  }

  /** Restated after the opening frames; sent only when something is held so a quiet session adds no frame before the snapshot. */
  opened(subscriber: Subscriber): void {
    const { sessionId } = subscriber
    const statuses = this.statusesBySession.get(sessionId)
    const promptHint = this.promptHintBySession.get(sessionId)
    const pane = this.paneBySession.get(sessionId)
    if (statuses || promptHint || pane) {
      this.send(subscriber, {
        ...(statuses ? { pluginStatuses: statuses } : {}),
        ...(promptHint ? { pluginPromptHint: promptHint } : {}),
        ...(pane ? { pluginPane: pane } : {})
      })
    }
  }

  private send(subscriber: Subscriber, fields: PluginSurfaceFields): void {
    if (!subscriber.boundedFrames) {
      const hostNow = this.port.now()
      this.port.send(subscriber, () => emptyAgentSessionBatchFrame(subscriber, hostNow, fields))
    }
  }
}
