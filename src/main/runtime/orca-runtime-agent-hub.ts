import { projectAgentHubGate, agentHubGateEvent } from './agent-hub/agent-hub-decision-gates'
import { createAgentHubOrbSessionManager } from '../agent-hub/orb/agent-hub-orb-session-manager'
import type { AgentHubOrbSessionManager } from '../agent-hub/orb/agent-hub-orb-session-manager'
import type { OrchestrationDb } from './orchestration/db'
import { OrcaRuntimeWithMigrationCatalog } from './orca-runtime-migration-catalog'
import { AgentHubLedger } from './agent-hub/agent-hub-ledger'
import type { AgentHubCaller, AgentHubGate } from '../../shared/agent-hub-requests'
import { RuntimePaneSpawnLineage } from './runtime-pane-spawn-lineage'
import type { TerminalSurfaceCloseTarget } from '../../shared/terminal-surface-close-target'
import { resolveStructuredWorkerAuthority } from './structured-worker-authority'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'

/** Agent Hub ledger, Orb and pane spawn lineage, layered over the upstream runtime chain. */
export abstract class OrcaRuntimeWithAgentHub extends OrcaRuntimeWithMigrationCatalog {
  private readonly paneSpawnLineage: RuntimePaneSpawnLineage
  readonly agentHubOrb: AgentHubOrbSessionManager = createAgentHubOrbSessionManager(
    this,
    this.store
  )

  readonly agentHub = new AgentHubLedger(
    (event) => this.emitClientEvent({ type: 'agentHub', event }),
    Date.now,
    (paneKey) => this.getAgentHubParentPaneKey(paneKey)
  )

  override async createTerminal(
    ...args: Parameters<OrcaRuntimeWithMigrationCatalog['createTerminal']>
  ) {
    const terminal = await super.createTerminal(...args)
    if (!terminal.isReattach) {
      this.paneSpawnLineage.record(terminal.handle, args[1]?.callerTerminalHandle)
    }
    return terminal
  }

  override async splitTerminal(
    ...args: Parameters<OrcaRuntimeWithMigrationCatalog['splitTerminal']>
  ) {
    const split = await super.splitTerminal(...args)
    this.paneSpawnLineage.record(split.handle, args[1]?.callerTerminalHandle)
    return split
  }

  override async createManagedWorktree(
    ...args: Parameters<OrcaRuntimeWithMigrationCatalog['createManagedWorktree']>
  ) {
    const result = await super.createManagedWorktree(...args)
    if (result.startupTerminal?.handle) {
      this.paneSpawnLineage.record(
        result.startupTerminal.handle,
        args[0].lineage?.callerTerminalHandle
      )
    }
    return result
  }

  pruneTerminalSpawnLineage(target: TerminalSurfaceCloseTarget): void {
    this.paneSpawnLineage.close(target)
  }

  restorePaneSpawnLineage(): void {
    this.paneSpawnLineage.restore()
  }

  getTerminalSpawnedBy(paneKey: string) {
    return this.paneSpawnLineage.get(paneKey)
  }

  recordWorkerSpawnLineage(
    childHandle: string,
    callerTerminalHandle: string | undefined,
    structuredSessionId?: string
  ): void {
    if (structuredSessionId) {
      this.paneSpawnLineage.recordPane(
        structuredAgentSessionPaneKey(
          structuredAgentSessionTabId(structuredSessionId),
          structuredSessionId
        ),
        callerTerminalHandle
      )
    } else {
      this.paneSpawnLineage.record(childHandle, callerTerminalHandle)
    }
  }

  getAgentHubParentPaneKey(paneKey: string): string | undefined {
    const orchestration = this.getAgentStatusOrchestrationContextForPaneKey(paneKey)
    if (orchestration) {
      if (orchestration.parentPaneKey) {
        return orchestration.parentPaneKey
      }
      for (const handle of [orchestration.parentTerminalHandle, orchestration.coordinatorHandle]) {
        const parent = handle ? this.getLiveTerminalPaneKey(handle) : null
        if (parent && parent !== paneKey) {
          return parent
        }
      }
      return undefined
    }
    return this.paneSpawnLineage.get(paneKey)?.paneKey
  }

  override getOrchestrationDb(): OrchestrationDb {
    const db = super.getOrchestrationDb()
    db.onDecisionGateChanged = (gate) => {
      try {
        this.emitClientEvent({
          type: 'agentHub',
          event: agentHubGateEvent(
            gate,
            projectAgentHubGate(db, gate, (handle) => this.getAgentHubCaller(handle))
          )
        })
      } catch (error) {
        console.warn('Could not publish decision gate', error)
      }
    }
    return db
  }

  getAgentHubGateSnapshot(): AgentHubGate[] {
    const db = this.getExistingOrchestrationDb()
    return db
      ? db
          .listGates({ status: 'pending' })
          .map((gate) => projectAgentHubGate(db, gate, (handle) => this.getAgentHubCaller(handle)))
      : []
  }

  isAgentHubEnabled(): boolean {
    // Why: partial stores (tests, early boot) have no getSettings.
    const settings = this.store?.getSettings?.()
    return settings?.experimentalAgentHub === true && settings.agentHubAgentControl !== false
  }

  getAgentHubCaller(handle: string): AgentHubCaller | null {
    const paneKey = this.getTerminalPaneKey(handle)
    if (!paneKey) {
      return null
    }
    const pty = this.getPtyRecordForPaneKey(paneKey)
    const agentType = pty?.foregroundAgent ?? pty?.launchAgent
    const title = pty?.title ?? (pty?.tabId ? this.tabs.get(pty.tabId)?.title : undefined)
    return {
      paneKey,
      terminalHandle: handle,
      ...(agentType ? { agentType } : {}),
      ...(title ? { title } : {})
    }
  }

  constructor(...args: ConstructorParameters<typeof OrcaRuntimeWithMigrationCatalog>) {
    super(...args)
    this.paneSpawnLineage = new RuntimePaneSpawnLineage({
      read: () => this.store?.getWorkspaceSession?.(),
      write: (session) => this.store?.setWorkspaceSession?.(session),
      resolveLivePane: (handle) => {
        const livePane = this.getLiveTerminalPaneKey(handle)
        const structured = livePane
          ? resolveStructuredWorkerAuthority(handle, this.getOrchestrationDbIfAvailable?.())
          : null
        // Status readers use the public session pane, not the worker's private authority leaf.
        return structured
          ? structuredAgentSessionPaneKey(
              structuredAgentSessionTabId(structured.running.sessionId),
              structured.running.sessionId
            )
          : livePane
      },
      publish: (paneKey, spawnedBy) => args[2]?.onPaneSpawnedByChanged?.(paneKey, spawnedBy)
    })
  }
}
