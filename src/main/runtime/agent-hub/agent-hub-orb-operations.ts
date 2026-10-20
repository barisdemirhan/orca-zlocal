import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type {
  AgentHubOrbOperation,
  AgentHubOrbOperationTarget
} from '../../../shared/agent-hub-orb-operation'
import type { AgentHubProgress } from '../../../shared/agent-hub-requests'

type Timer = ReturnType<typeof setTimeout> | NodeJS.Timeout
type Lease = {
  operation: AgentHubOrbOperation
  controller: AbortController
  timer: Timer
  event: AgentHubProgress
  /** Set between writes of one Orb turn; only the owning Orb session may write meanwhile. */
  idleTimer?: Timer
}
// Keeps the lease across text -> Enter and consecutive sends so the user cannot slip input in.
export const ORB_OPERATION_IDLE_GRACE_MS = 1_750
const ORPHAN_LEASE_MS = 120_000
const unref = (timer: Timer): Timer => {
  if (typeof timer !== 'number') {
    timer.unref()
  }
  return timer
}
const registries = new WeakMap<object, AgentHubOrbOperations>()
export function registerOrbOperations(runtime: object, operations: AgentHubOrbOperations): void {
  registries.set(runtime, operations)
}
export function readOrbOperations(runtime: object): AgentHubOrbOperations | undefined {
  return registries.get(runtime)
}
function sameTarget(a: AgentHubOrbOperationTarget, b: AgentHubOrbOperationTarget): boolean {
  if (a.kind === 'session' || b.kind === 'session') {
    return a.kind === 'session' && b.kind === 'session' && a.sessionId === b.sessionId
  }
  if (a.kind === 'terminal' && b.kind === 'terminal') {
    return a.ptyId === b.ptyId
  }
  return Boolean(a.paneKey && a.paneKey === b.paneKey)
}

/** Host-owned input protection; it never changes the terminal's mobile/desktop driver. */
export class AgentHubOrbOperations {
  private readonly active = new Map<string, Lease>()
  private readonly current = new AsyncLocalStorage<Lease>()

  constructor(
    private readonly publish: (event: AgentHubProgress) => void,
    private readonly idleGraceMs = ORB_OPERATION_IDLE_GRACE_MS
  ) {}

  snapshot(): AgentHubProgress[] {
    return [...this.active.values()].map((lease) => lease.event)
  }

  /** `ownerSessionId` lets the Orb that holds an idle lease continue writing during its grace. */
  assertWritable(target: AgentHubOrbOperationTarget, ownerSessionId?: string): void {
    const caller = this.current.getStore()
    if (
      caller &&
      (!sameTarget(caller.operation.target, target) ||
        caller.controller.signal.aborted ||
        this.active.get(caller.operation.id) !== caller)
    ) {
      throw new Error('orb_operation_cancelled: The user took control. Do not retry automatically.')
    }
    for (const lease of this.active.values()) {
      const ownIdle = lease.idleTimer !== undefined && lease.operation.sessionId === ownerSessionId
      if (sameTarget(lease.operation.target, target) && caller !== lease && !ownIdle) {
        throw new Error('orb_target_busy: Orb is working here. Take control before writing.')
      }
    }
  }

  canWrite(target: AgentHubOrbOperationTarget): boolean {
    try {
      this.assertWritable(target)
      return true
    } catch {
      return false
    }
  }

  async run<T>(
    sessionId: string,
    target: AgentHubOrbOperationTarget,
    method: string,
    action: (signal: AbortSignal) => T | Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    this.assertWritable(target, sessionId)
    const lease = this.renewIdle(sessionId, target) ?? this.start(sessionId, target, method)
    const cancel = () => this.release(lease.operation.id)
    signal?.addEventListener('abort', cancel, { once: true })
    try {
      if (signal?.aborted) {
        cancel()
      }
      return await this.current.run(lease, async () => {
        this.assertWritable(target)
        const leaseSignal = lease.controller.signal
        return action(signal ? AbortSignal.any([signal, leaseSignal]) : leaseSignal)
      })
    } finally {
      signal?.removeEventListener('abort', cancel)
      this.settle(lease, signal?.aborted === true)
    }
  }

  private start(sessionId: string, target: AgentHubOrbOperationTarget, method: string): Lease {
    const operation: AgentHubOrbOperation = {
      id: randomUUID(),
      sessionId,
      target,
      method,
      active: true
    }
    const now = Date.now()
    const paneKey = `orb-operation:${operation.id}`
    const lease: Lease = {
      operation,
      controller: new AbortController(),
      // Orphan recovery only; normal release follows the operation's idle grace.
      timer: unref(setTimeout(() => this.release(operation.id), ORPHAN_LEASE_MS)),
      event: {
        kind: 'progress',
        requestId: operation.id,
        caller: {
          kind: 'orb',
          sessionId,
          paneKey: `orb:${sessionId}`,
          terminalHandle: `orb:${sessionId}`
        },
        target: { paneKey, terminalHandle: paneKey },
        createdAt: now,
        expiresAt: now + ORPHAN_LEASE_MS,
        text: 'Orb is working here',
        orbOperation: operation
      }
    }
    this.active.set(operation.id, lease)
    this.publish(lease.event)
    return lease
  }

  /** Reuses the Orb's own lease that is waiting out its idle grace on the same target. */
  private renewIdle(sessionId: string, target: AgentHubOrbOperationTarget): Lease | undefined {
    for (const lease of this.active.values()) {
      if (
        lease.idleTimer !== undefined &&
        lease.operation.sessionId === sessionId &&
        sameTarget(lease.operation.target, target)
      ) {
        clearTimeout(lease.idleTimer)
        lease.idleTimer = undefined
        clearTimeout(lease.timer)
        lease.timer = unref(setTimeout(() => this.release(lease.operation.id), ORPHAN_LEASE_MS))
        lease.event = { ...lease.event, expiresAt: Date.now() + ORPHAN_LEASE_MS }
        this.publish(lease.event)
        return lease
      }
    }
    return undefined
  }

  private settle(lease: Lease, aborted: boolean): void {
    if (this.active.get(lease.operation.id) !== lease) {
      return
    }
    if (aborted || this.idleGraceMs <= 0) {
      this.release(lease.operation.id)
      return
    }
    lease.idleTimer = unref(setTimeout(() => this.release(lease.operation.id), this.idleGraceMs))
  }

  release(id: string): boolean {
    const lease = this.active.get(id)
    if (!lease) {
      return false
    }
    this.active.delete(id)
    clearTimeout(lease.timer)
    clearTimeout(lease.idleTimer)
    lease.controller.abort()
    this.publish({
      ...lease.event,
      text: null,
      orbOperation: { ...lease.operation, active: false }
    })
    return true
  }

  dispose(): void {
    for (const id of this.active.keys()) {
      this.release(id)
    }
  }
}
