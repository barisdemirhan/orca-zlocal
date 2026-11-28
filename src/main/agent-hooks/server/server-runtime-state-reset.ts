import { AgentHookServerClaudeStatusLineModel } from './server-claude-statusline-model'

export abstract class AgentHookServerRuntimeStateReset extends AgentHookServerClaudeStatusLineModel {
  protected resetHookRuntimeState(): void {
    this.clearAllAssistantMessageRetries()
    this.hookSilenceRechecks.clear()
    this.programStatusFacetRepublishes.clear()
    this.clearAllTranscriptPolls()
    this.claudeOwedNotificationExpiry.clearAll()
    this.endpointDir = null
    this.endpointFilePathCache = null
    this.endpointFileWritten = false
    this.setStatusFilePath(null)
    this.closeStatusSnapshotWriter()
    this.agentIdentities.close()
    this.clearRuntimeStatusQueries()
    this.hydratedAuthorityCommitments = Object.freeze([])
    this.hydratedLaunchTokenHashByPaneKey.clear()
    this.persistedAuthorityCommitmentsByPaneKey.clear()
    this.revokedHydratedAuthorityCommitments = new WeakSet()
    this.currentAuthorityObservations.clear()
    this.promptSentDedupeByPaneKey.clear()
    this.closedAgentStatusTabIds.clear()
    this.closedAgentStatusPaneKeys.clear()
    this.restartedStatusLaunchTokenHashByPaneKey.clear()
    this.retiredPaneFencesByKey.clear()
    this.connectionTimestampWatermarkById.clear()
    this.evidenceObservedAtByPaneKey.clear()
    this.programStatusFacets.clear()
    this.activeHookTurnCompletedAtByPaneKey.clear()
    this.legacyPaneKeyAliases.clear()
    this.paneKeyAliasPersistenceListener = null
    this.ownerStateInitialized = false
    // Leave the endpoint: stale files fail open, and unlinking can race another Orca instance.
    this.providerRowsByTab = null
  }
}
