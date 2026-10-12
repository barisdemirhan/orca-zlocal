import type { AgentStatusEntry } from '../../shared/agent-status-types'
import type { TerminalSurfaceCloseTarget } from '../../shared/terminal-surface-close-target'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import { parsePaneKey } from '../../shared/stable-pane-id'

type SpawnedBy = NonNullable<AgentStatusEntry['spawnedBy']>
type Lineage = Record<string, SpawnedBy>

export class RuntimePaneSpawnLineage {
  private links: Lineage

  constructor(
    private readonly deps: {
      read: () => WorkspaceSessionState | undefined
      write: (session: WorkspaceSessionState) => void
      resolveLivePane: (handle: string) => string | null
      publish: (paneKey: string, spawnedBy: SpawnedBy | undefined) => void
    }
  ) {
    this.links = { ...deps.read()?.terminalSpawnedByPaneKey }
    for (const [paneKey, spawnedBy] of Object.entries(this.links)) {
      deps.publish(paneKey, spawnedBy)
    }
  }

  get(paneKey: string): SpawnedBy | undefined {
    return this.links[paneKey]
  }

  record(childHandle: string, callerHandle: string | undefined): void {
    if (!callerHandle) {
      return
    }
    const child = this.deps.resolveLivePane(childHandle)
    const parent = this.deps.resolveLivePane(callerHandle)
    if (!child || !parent || child === parent || this.links[child]) {
      return
    }
    const seen = new Set([child])
    for (let pane: string | undefined = parent; pane; pane = this.links[pane]?.paneKey) {
      if (seen.has(pane)) {
        return
      }
      seen.add(pane)
    }
    this.links = { ...this.links, [child]: { paneKey: parent } }
    this.persist()
    this.deps.publish(child, this.links[child])
  }

  close(target: TerminalSurfaceCloseTarget): void {
    const matches = (paneKey: string): boolean => {
      const pane = parsePaneKey(paneKey)
      return (
        pane?.tabId === target.tabId && (target.kind === 'tab' || pane.leafId === target.leafId)
      )
    }
    const next: Lineage = {}
    const removed: string[] = []
    for (const [child, parent] of Object.entries(this.links)) {
      if (matches(child) || matches(parent.paneKey)) {
        removed.push(child)
      } else {
        next[child] = parent
      }
    }
    if (!removed.length) {
      return
    }
    this.links = next
    this.persist()
    for (const child of removed) {
      this.deps.publish(child, undefined)
    }
  }

  private persist(): void {
    const session = this.deps.read()
    if (session) {
      this.deps.write({ ...session, terminalSpawnedByPaneKey: this.links })
    }
  }
}
