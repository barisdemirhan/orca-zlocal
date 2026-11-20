import { parsePaneKey } from '../../shared/workspace-layout/stable-pane-id'
import { readAgentProcessIdentity } from '../../shared/agent-status/process/agent-process-presence'
import type { AgentHookSource } from '../../shared/agent-hook-listener/transport/agent-hook-relay'
import type { ProcessTableRow } from '../../shared/process-observation/tables/process-table-snapshot'
import { getProcessTableSnapshot } from '../../shared/process-observation/tables/process-table-snapshot-reader'
import {
  collectDescendantsFromIndex,
  getProcessTableIndex
} from '../../shared/process-observation/tables/process-table-index'
import { listRegisteredPtys, type PtyRegistration } from '../memory/pty-registry'

const CLAUDE_ATTACH_COMMAND = /(?:^|[\\/\s])claude(?:\.exe)?\s+attach(?:\s|$)/
// Unadopted panes after a restart look orphaned too; don't scan the process table per hook.
const UNROUTED_RECHECK_MS = 30_000
const ROUTES_MAX = 64

type RoutingPane = Pick<PtyRegistration, 'paneKey' | 'worktreeId' | 'pid'>

export type ClaudeAttachHookRoutingDeps = {
  listPanes: () => readonly RoutingPane[]
  readProcessTable: () => Promise<readonly ProcessTableRow[]>
  now: () => number
}

/**
 * The single attach pane that can speak for a sender living outside every pane's process tree,
 * or null when the sender belongs to a pane or the choice is ambiguous.
 */
export function selectClaudeAttachPane(args: {
  senderPid: number
  worktreeId: string
  panes: readonly RoutingPane[]
  rows: readonly ProcessTableRow[]
}): string | null {
  const index = getProcessTableIndex(args.rows)
  if (!index.byPid.has(args.senderPid)) {
    return null
  }
  const targets = new Set<string>()
  for (const pane of args.panes) {
    if (!pane.pid) {
      continue
    }
    const tree = collectDescendantsFromIndex(index, pane.pid)
    if (pane.pid === args.senderPid || tree.some((row) => row.pid === args.senderPid)) {
      return null
    }
    if (
      pane.paneKey &&
      pane.worktreeId === args.worktreeId &&
      tree.some((row) => CLAUDE_ATTACH_COMMAND.test(row.command))
    ) {
      targets.add(pane.paneKey)
    }
  }
  return targets.size === 1 ? [...targets][0] : null
}

/**
 * `claude --bg` sessions outlive the tab that started them, so their hooks keep naming a closed
 * pane. Route those to the pane where `claude attach` shows the session.
 */
export class ClaudeAttachHookRouter {
  private readonly routes = new Map<string, string>()
  private readonly unroutedUntil = new Map<string, number>()

  constructor(
    private readonly deps: ClaudeAttachHookRoutingDeps = {
      listPanes: listRegisteredPtys,
      readProcessTable: getProcessTableSnapshot,
      now: Date.now
    }
  ) {}

  async route(source: AgentHookSource, body: unknown): Promise<unknown> {
    if (
      source !== 'claude' ||
      process.platform === 'win32' ||
      typeof body !== 'object' ||
      body === null
    ) {
      return body
    }
    const record = body as Record<string, unknown>
    const paneKey = typeof record.paneKey === 'string' ? record.paneKey.trim() : ''
    const worktreeId = typeof record.worktreeId === 'string' ? record.worktreeId.trim() : ''
    const sender = readAgentProcessIdentity(record.agentProcess)
    if (!paneKey || !worktreeId || !sender || !parsePaneKey(paneKey)) {
      return body
    }
    const panes = this.deps.listPanes()
    const isLive = (key: string): boolean => panes.some((pane) => pane.paneKey === key)
    if (isLive(paneKey)) {
      this.routes.delete(paneKey)
      return body
    }
    const cached = this.routes.get(paneKey)
    if (cached && isLive(cached)) {
      return withPaneKey(record, cached)
    }
    this.routes.delete(paneKey)
    const now = this.deps.now()
    if ((this.unroutedUntil.get(paneKey) ?? 0) > now) {
      return body
    }
    let target: string | null = null
    try {
      target = selectClaudeAttachPane({
        senderPid: sender.pid,
        worktreeId,
        panes,
        rows: await this.deps.readProcessTable()
      })
    } catch {
      target = null
    }
    if (!target) {
      remember(this.unroutedUntil, paneKey, now + UNROUTED_RECHECK_MS)
      return body
    }
    this.unroutedUntil.delete(paneKey)
    remember(this.routes, paneKey, target)
    return withPaneKey(record, target)
  }
}

function withPaneKey(record: Record<string, unknown>, paneKey: string): Record<string, unknown> {
  return { ...record, paneKey, tabId: parsePaneKey(paneKey)?.tabId }
}

function remember<T>(map: Map<string, T>, key: string, value: T): void {
  map.delete(key)
  map.set(key, value)
  while (map.size > ROUTES_MAX) {
    const oldest = map.keys().next().value
    if (oldest === undefined) {
      break
    }
    map.delete(oldest)
  }
}
