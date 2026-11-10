import { useSyncExternalStore } from 'react'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { RuntimeFileReadArgs } from '@/runtime/files/runtime-file-client-types'

/** The paired server that owns a peeked file, or null for local and SSH reads. */
export function peekReadRuntimeEnvironmentId(
  readContext: RuntimeFileReadArgs | undefined
): string | null {
  return readContext?.target.kind === 'environment' ? readContext.target.environmentId : null
}

export type AgentHubPeekContent =
  | {
      kind: 'web'
      url: string
      hostId: ExecutionHostId
      /** The host whose browser route the page takes when that differs from `hostId`. */
      routeHostId?: ExecutionHostId
      routingWorktreeId?: string
      /** A host's private name: it opens only when this device resolves it to that machine. */
      resolveNameHere?: boolean
    }
  | {
      kind: 'image' | 'pdf' | 'media' | 'markdown' | 'csv' | 'mermaid' | 'notebook' | 'text'
      filePath: string
      connectionId: string | null
      readContext?: RuntimeFileReadArgs
      initialAnchor?: string | null
      line?: number | null
      column?: number | null
    }

/** One thing to look at, with the ways out the place it was found offers. */
export type AgentHubPeekItem = {
  /** Agent-opened previews leave keyboard input with its current owner. */
  preserveKeyboardFocus?: boolean
  fromOrb?: boolean
  content: AgentHubPeekContent
  worktreeId: string
  title: string
  /** The full URL or path, shown under the title. */
  location: string
  /** The mirror window it was clicked in, if any. */
  mirrorKey: string | null
  /** Opens it the way Orca would have without Peek (a workspace tab or the editor). */
  openInWorkspace: () => void
  /** The system browser for a page, the default app for a file. */
  openExternally: (() => void) | null
}

type AgentHubPeekState = { history: readonly AgentHubPeekItem[]; index: number } | null

let state: AgentHubPeekState = null
const listeners = new Set<() => void>()
let hosts = 0

/** Peek opens only while something can show it (the hub is mounted, not in Settings). */
export function registerAgentHubPeekHost(): () => void {
  hosts += 1
  return () => {
    hosts -= 1
  }
}

export function isAgentHubPeekHostMounted(): boolean {
  return hosts > 0
}

function commit(next: AgentHubPeekState): void {
  state = next
  listeners.forEach((listener) => listener())
}

/** One Peek at a time: a new item replaces what is shown and the old one stays a step back. */
export function openAgentHubPeek(item: AgentHubPeekItem): void {
  const kept = state ? state.history.slice(0, state.index + 1) : []
  // Why: one click can reach two link handlers; the same thing again is not a step forward.
  if (kept.at(-1)?.location === item.location) {
    kept.pop()
  }
  commit({ history: [...kept, item], index: kept.length })
}

export function goBackAgentHubPeek(): void {
  if (state && state.index > 0) {
    commit({ ...state, index: state.index - 1 })
  }
}

export function closeAgentHubPeek(): void {
  if (state) {
    commit(null)
  }
}

export function readAgentHubPeek(): AgentHubPeekState {
  return state
}

export function useAgentHubPeek(): AgentHubPeekState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state
  )
}
