import { cliWriterExecutionMatcher, type CliWriterExecutionMatches } from './cli-writer-observation'
import type {
  AgentStatusClearIpcPayload,
  AgentStatusIpcPayload
} from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import type { ClaudeStatusLineRateLimits } from '../../../shared/agent-usage/rate-limits/claude-statusline-rate-limits'
import type { HookTransportInterferenceReport } from '../../../shared/agent-hook-listener/transport/agent-hook-transport-interference'
import type { HookListenerState } from '../../../shared/agent-hook-listener/listener-state'
import type {
  AgentHookAuthorityEvidence,
  AgentHookProviderSessionIdentity,
  AgentHookStatusChangeEntry,
  EnrichedAgentHookEventPayload
} from './server-types'
import { toAgentStatusIpcPayload } from './server-status-identity'
import { combinedAgentStatusEntries } from './combined-agent-status-entries'
import { PaneTimers } from './program-status/pane-timers'
import { ProgramStatusFacetStore } from './program-status/facet-store'
import { AgentHookServerListenerSubscriptions } from './server-listener-subscriptions'
import { publishedOrcaSessionId } from '../identity/pane-agent-identities'

export abstract class AgentHookServerListeners extends AgentHookServerListenerSubscriptions {
  protected statusChangeNotificationVersion = 0
  protected cliWriterExecutionMatches: CliWriterExecutionMatches | null = null

  setCliWriterExecutionMatcher(...args: Parameters<typeof cliWriterExecutionMatcher>): void {
    this.cliWriterExecutionMatches = cliWriterExecutionMatcher(...args)
  }
  protected readonly programStatusFacets = new ProgramStatusFacetStore()
  /** Retry yielded OSC 7501 reports when hook precedence expires; programs may not resend. */
  protected readonly hookSilenceRechecks = new PaneTimers()
  /** Coalesce facet-only ticks that arrive at PTY chunk rate. */
  protected readonly programStatusFacetRepublishes = new PaneTimers()

  private readonly paneSpawnedBy = new Map<string, { paneKey: string }>()

  setPaneSpawnedBy(paneKey: string, spawnedBy: { paneKey: string } | undefined): void {
    if (spawnedBy) {
      this.paneSpawnedBy.set(paneKey, spawnedBy)
    } else {
      this.paneSpawnedBy.delete(paneKey)
    }
    for (const entry of this.combinedStatusEntries()) {
      if (entry.paneKey === paneKey) {
        this.emitEnrichedStatus(entry)
      }
    }
    this.notifyStatusChangeListeners()
  }

  private withSpawnedBy<T extends { paneKey: string }>(
    entry: T
  ): T & { spawnedBy?: { paneKey: string } } {
    return { ...entry, spawnedBy: this.paneSpawnedBy.get(entry.paneKey) }
  }

  setStartupPromptClaimListener(
    listener: (body: unknown) => boolean | 'pending',
    clear: () => void
  ): void {
    this.onStartupPromptClaim = listener
    this.clearStartupPromptClaims = clear
  }

  protected emitEnrichedStatus(row: EnrichedAgentHookEventPayload): void {
    const enriched = this.withSpawnedBy(this.programStatusFacets.stitch(row))
    this.onAgentStatus?.(enriched)
    for (const listener of this.enrichedStatusListeners) {
      try {
        listener(enriched)
      } catch (err) {
        console.error('[agent-hooks] enriched status listener threw', err)
      }
    }
  }

  getCanonicalStatusSnapshot() {
    return this.canonicalStatusStore.getSnapshot()
  }

  _resetCanonicalStatusForTests(): void {
    this.resetCanonicalStatus()
  }

  protected override resetCanonicalStatus(): void {
    super.resetCanonicalStatus()
    this.statusQueryIndex = null
    this.agentIdentities.dropCanonical()
    this.providerRowsByTab = null
  }

  /** `withAgentIds` false: an internal notification that outputs no ID does no ID work. */
  private combinedStatusEntries(
    paneKey?: string,
    withAgentIds = true
  ): EnrichedAgentHookEventPayload[] {
    return combinedAgentStatusEntries(
      {
        state: this.state,
        programStatusFacets: this.programStatusFacets,
        ...(withAgentIds
          ? { canonicalIdentity: (key: string) => this.agentIdentities.canonicalIdentity(key) }
          : {}),
        canonicalStatusStore: this.canonicalStatusStore,
        canonicalSubjectsByPane: this.canonicalSubjectsByPane,
        canonicalListingOrder: this.canonicalListingOrder
      },
      paneKey
    )
  }
  /** Report repeated hook-body truncation once per process; fail-open handling otherwise hides it (#11217). */
  setTransportInterferenceListener(
    listener: ((report: HookTransportInterferenceReport) => void) | null
  ): void {
    this.onTransportInterference = listener
  }

  setListener(listener: ((payload: EnrichedAgentHookEventPayload) => void) | null): void {
    this.onAgentStatus = listener
    if (!listener) {
      return
    }
    // One failing replay subscriber must not starve other panes.
    for (const payload of this.combinedStatusEntries()) {
      try {
        listener(this.withSpawnedBy({ ...payload, isReplay: true }))
      } catch (err) {
        console.error('[agent-hooks] replay listener threw', err)
      }
    }
  }

  // Claude statusline carries usage windows for RateLimitService, not agent status.
  setClaudeStatusLineListener(
    listener: ((event: ClaudeStatusLineRateLimits) => void) | null
  ): void {
    this.onClaudeStatusLine = listener
  }

  /** Replay is durable evidence from a prior runtime, not a live observation. */
  protected withdrawReplayObservation(paneKey: string): void {
    if (this.runtimeObservedStatusPaneKeys.delete(paneKey)) {
      this.notifyStatusChangeListeners()
    }
  }

  setPaneStatusClearListener(listener: ((clear: AgentStatusClearIpcPayload) => void) | null): void {
    this.onPaneStatusCleared = listener
  }

  getStatusSnapshot(): AgentStatusIpcPayload[] {
    return this.combinedStatusEntries().map((entry) =>
      this.withSpawnedBy(toAgentStatusIpcPayload(entry))
    )
  }

  /** Include metadata-only provider identities. */
  getProviderSessionIdentities(): AgentHookProviderSessionIdentity[] {
    return this.buildStatusChangeNotification().providerSessions
  }

  getStatusRowsForPaneOrHandle(
    paneKey: string,
    terminalHandle?: string | null
  ): AgentStatusIpcPayload[] {
    const handlePaneKey = terminalHandle
      ? this.paneKeyByTerminalHandle.get(terminalHandle)
      : undefined
    return Array.from(new Set([paneKey, ...(handlePaneKey ? [handlePaneKey] : [])]))
      .flatMap((key) => this.combinedStatusEntries(key))
      .map(toAgentStatusIpcPayload)
  }

  getPublicStatusSnapshotForPane(
    paneKey: string,
    terminalHandle?: string | null
  ): AgentStatusIpcPayload[] {
    return this.getStatusRowsForPaneOrHandle(paneKey, terminalHandle).filter(
      (row) => row.providerSessionOnly !== true
    )
  }

  getStatusSnapshotForPane(paneKey: string): AgentStatusIpcPayload[] {
    const legacy = this.state.lastStatusByPaneKey.get(paneKey)
    if (legacy) {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Main admits enriched legacy rows; the shared view declares their base event type.
      const row = legacy as EnrichedAgentHookEventPayload
      return [this.withSpawnedBy(toAgentStatusIpcPayload(this.programStatusFacets.stitch(row)))]
    }
    const rows: AgentStatusIpcPayload[] = []
    for (const [subjectKey, subject] of this.canonicalSubjectsByPane.get(paneKey) ?? []) {
      const status = this.canonicalStatusStore.getParent(subject)?.status
      const identity = status?.structuredHost
        ? undefined
        : this.agentIdentities.canonicalIdentity(subjectKey)
      if (status) {
        const orcaSessionId = publishedOrcaSessionId(identity)
        rows.push(
          this.withSpawnedBy(orcaSessionId !== undefined ? { ...status, orcaSessionId } : status)
        )
      }
    }
    return rows
  }

  /** The lead's full final reply for the finished turn `leadTurnKey` names, when this runtime admitted one. */
  getAcceptedReply(paneKey: string, leadTurnKey: number): string | undefined {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Main admits enriched legacy rows; the shared view declares their base event type.
    const row = this.state.lastStatusByPaneKey.get(paneKey) as
      | EnrichedAgentHookEventPayload
      | undefined
    return row?.acceptedReply?.leadTurnKey === leadTurnKey ? row.acceptedReply.text : undefined
  }

  getHydratedAuthorityCommitments(): readonly AgentHookAuthorityEvidence[] {
    return this.hydratedAuthorityCommitments
  }

  getCurrentAuthorityObservations(): readonly AgentHookAuthorityEvidence[] {
    return Object.freeze(
      Array.from(this.currentAuthorityObservations.values(), (entry) => Object.freeze({ ...entry }))
    )
  }

  protected buildStatusChangeNotification(): {
    statuses: AgentHookStatusChangeEntry[]
    providerSessions: AgentHookProviderSessionIdentity[]
  } {
    const statuses: AgentHookStatusChangeEntry[] = []
    const providerSessions: AgentHookProviderSessionIdentity[] = []
    for (const enriched of this.combinedStatusEntries(undefined, false)) {
      const paneKey = enriched.paneKey
      if (enriched.providerSession) {
        providerSessions.push({
          paneKey,
          sessionId: enriched.providerSession.id,
          ...(enriched.providerSession.transcriptPath
            ? { transcriptPath: enriched.providerSession.transcriptPath }
            : {}),
          ...(enriched.worktreeId ? { worktreeId: enriched.worktreeId } : {})
        })
      }
      if (!enriched.providerSessionOnly) {
        statuses.push({
          paneKey,
          state: enriched.payload.state,
          receivedAt: enriched.receivedAt,
          observedInCurrentRuntime:
            Boolean(enriched.structuredHost) || this.runtimeObservedStatusPaneKeys.has(paneKey)
        })
      }
    }
    return { statuses, providerSessions }
  }

  protected notifyStatusChangeListeners(): void {
    this.providerRowsByTab = null
    this.statusChangeNotificationVersion++
    if (this.statusChangeListeners.size === 0 && this.providerSessionChangeListeners.size === 0) {
      return
    }
    const { statuses, providerSessions } = this.buildStatusChangeNotification()
    for (const listener of this.statusChangeListeners) {
      try {
        listener(statuses)
      } catch (err) {
        console.error('[agent-hooks] status-change listener threw', err)
      }
    }
    for (const listener of this.providerSessionChangeListeners) {
      try {
        listener(providerSessions)
      } catch (err) {
        console.error('[agent-hooks] provider-session listener threw', err)
      }
    }
  }

  getStatusChangeSnapshot(): AgentHookStatusChangeEntry[] {
    return this.buildStatusChangeNotification().statuses
  }

  _getStateForTests(): HookListenerState {
    return this.state
  }
}
