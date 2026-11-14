import type { AgentStatusEntry } from '../../shared/agent-status/contracts/agent-status-types'
import type { TerminalSurfaceCloseTarget } from '../../shared/workspace-layout/terminal-surfaces/terminal-surface-close-target'
import type { WorkspaceSessionState } from '../../shared/workspace-session/workspace-session-state-types'
import { parsePaneKey } from '../../shared/workspace-layout/stable-pane-id'
import { terminalLayoutContainsLeaf } from '../../shared/workspace-session/workspace-session-pane-ownership'

type SpawnedBy = NonNullable<AgentStatusEntry['spawnedBy']>
type Lineage = Record<string, SpawnedBy>

export class RuntimePaneSpawnLineage {
  // Why lazy: tests and hot paths bound session reads; the host restores links once at startup.
  private loaded: Lineage | null = null

  constructor(
    private readonly deps: {
      read: () => WorkspaceSessionState | undefined
      write: (session: WorkspaceSessionState) => void
      resolveLivePane: (handle: string) => string | null
      publish: (paneKey: string, spawnedBy: SpawnedBy | undefined) => void
    }
  ) {}

  private get links(): Lineage {
    this.loaded ??= { ...this.deps.read()?.terminalSpawnedByPaneKey }
    return this.loaded
  }

  private set links(next: Lineage) {
    this.loaded = next
  }

  /** Publishes the persisted links once the host's status readers are wired. */
  restore(): void {
    const session = this.deps.read()
    if (session) {
      const tabIds = new Set([
        ...Object.values(session.tabsByWorktree)
          .flat()
          .map((tab) => tab.id),
        ...Object.values(session.unifiedTabs ?? {})
          .flat()
          .map((tab) => tab.id)
      ])
      this.prune((paneKey) => {
        const pane = parsePaneKey(paneKey)
        if (!pane || !tabIds.has(pane.tabId)) {
          return false
        }
        const layout = session.terminalLayoutsByTabId[pane.tabId]
        return !layout?.root || terminalLayoutContainsLeaf(layout.root, pane.leafId)
      })
    }
    for (const [paneKey, spawnedBy] of Object.entries(this.links)) {
      this.deps.publish(paneKey, spawnedBy)
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
    if (child) {
      this.recordPane(child, callerHandle)
    }
  }

  /** A host-created structured session has a status pane, but no PTY handle. */
  recordPane(child: string, callerHandle: string | undefined): void {
    if (!callerHandle) {
      return
    }
    const parent = this.deps.resolveLivePane(callerHandle)
    if (!parent || child === parent || this.links[child]) {
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
    this.prune((paneKey) => !matches(paneKey))
  }

  private prune(keep: (paneKey: string) => boolean): void {
    const next: Lineage = {}
    const removed: string[] = []
    for (const [child, parent] of Object.entries(this.links)) {
      if (!keep(child) || !keep(parent.paneKey)) {
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
