import type { AgentStatusClearIpcPayload } from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import type {
  AgentHookProviderSessionIdentity,
  AgentHookStatusChangeEntry,
  AgentHookStatusFreshnessObservation,
  EnrichedAgentHookEventPayload,
  StatusDropListener
} from './server-types'
import { AgentHookServerAgentIdentities } from './server-agent-identities'

export abstract class AgentHookServerListenerSubscriptions extends AgentHookServerAgentIdentities {
  subscribeStatusChanges(listener: (statuses: AgentHookStatusChangeEntry[]) => void): () => void {
    this.statusChangeListeners.add(listener)
    return () => {
      this.statusChangeListeners.delete(listener)
    }
  }

  /** Accepted duplicate evidence renews leases without becoming a semantic row mutation. */
  subscribeStatusFreshness(
    listener: (status: AgentHookStatusFreshnessObservation) => void
  ): () => void {
    this.statusFreshnessListeners.add(listener)
    return () => {
      this.statusFreshnessListeners.delete(listener)
    }
  }

  protected emitStatusFreshnessObservation(status: AgentHookStatusFreshnessObservation): void {
    for (const listener of this.statusFreshnessListeners) {
      try {
        listener(status)
      } catch (err) {
        console.error('[agent-hooks] status-freshness listener threw', err)
      }
    }
  }

  subscribeProviderSessionChanges(
    listener: (providerSessions: AgentHookProviderSessionIdentity[]) => void
  ): () => void {
    this.providerSessionChangeListeners.add(listener)
    return () => {
      this.providerSessionChangeListeners.delete(listener)
    }
  }

  /** Include user-dismissed rows, which bypass pane-clear events but must still retire pane-owned UI. */
  subscribeStatusDrop(listener: StatusDropListener): () => void {
    this.statusDropListeners.add(listener)
    return () => {
      this.statusDropListeners.delete(listener)
    }
  }

  protected emitStatusDropped(paneKey: string): void {
    for (const listener of this.statusDropListeners) {
      try {
        listener(paneKey)
      } catch (err) {
        console.error('[agent-hooks] status-drop listener threw', err)
      }
    }
  }

  /** Enriched changes only; no replay. */
  subscribeEnrichedStatus(listener: (payload: EnrichedAgentHookEventPayload) => void): () => void {
    this.enrichedStatusListeners.add(listener)
    return () => {
      this.enrichedStatusListeners.delete(listener)
    }
  }

  /** Survives window teardown and works under headless serve, unlike the window's single listener slot. */
  subscribePaneStatusClear(listener: (clear: AgentStatusClearIpcPayload) => void): () => void {
    this.paneStatusClearListeners.add(listener)
    return () => {
      this.paneStatusClearListeners.delete(listener)
    }
  }

  protected emitPaneStatusCleared(clear: AgentStatusClearIpcPayload): void {
    this.onPaneStatusCleared?.(clear)
    for (const listener of this.paneStatusClearListeners) {
      // One throwing subscriber must not interrupt teardown for the others.
      try {
        listener(clear)
      } catch (err) {
        console.error('[agent-hooks] pane-status-clear listener threw', err)
      }
    }
  }
}
