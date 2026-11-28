import { useSyncExternalStore } from 'react'

export type TerminalMountRetentionLease = { worktreeId: string; tabId: string }

let mirrorLeases: readonly TerminalMountRetentionLease[] = []
const inputLeases = new Map<symbol, TerminalMountRetentionLease>()
let snapshot: readonly TerminalMountRetentionLease[] = []
const listeners = new Set<() => void>()

function publish(): void {
  snapshot = [...mirrorLeases, ...inputLeases.values()]
  listeners.forEach((listener) => listener())
}

export function setTerminalMirrorMountLeases(leases: readonly TerminalMountRetentionLease[]): void {
  if (
    leases.length === mirrorLeases.length &&
    leases.every(
      (lease, index) =>
        lease.worktreeId === mirrorLeases[index]?.worktreeId &&
        lease.tabId === mirrorLeases[index]?.tabId
    )
  ) {
    return
  }
  mirrorLeases = leases
  publish()
}

export function acquireTerminalInputMountLease(lease: TerminalMountRetentionLease): () => void {
  const token = Symbol(lease.tabId)
  inputLeases.set(token, lease)
  publish()
  return () => {
    if (inputLeases.delete(token)) {
      publish()
    }
  }
}

export function getTerminalMountRetentionLeases(): readonly TerminalMountRetentionLease[] {
  return snapshot
}

export function hasTerminalMountRetentionLease(worktreeId: string, tabId?: string): boolean {
  return snapshot.some(
    (lease) => lease.worktreeId === worktreeId && (tabId === undefined || lease.tabId === tabId)
  )
}

export function useTerminalMountRetentionLeases(): readonly TerminalMountRetentionLease[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getTerminalMountRetentionLeases,
    getTerminalMountRetentionLeases
  )
}

export function useTerminalMountRetentionMembership(worktreeId: string): {
  tabIds: ReadonlySet<string>
  key: string
} {
  const leases = useTerminalMountRetentionLeases()
  const ids = leases
    .filter((lease) => lease.worktreeId === worktreeId)
    .map((lease) => lease.tabId)
    .toSorted()
  const key = JSON.stringify(ids)
  return { tabIds: new Set(ids), key }
}
