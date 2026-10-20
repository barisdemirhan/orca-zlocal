import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type {
  AgentHubOrbOperation,
  AgentHubOrbOperationTarget
} from '../../../shared/agent-hub-orb-operation'
import type { AgentHubProgress } from '../../../shared/agent-hub-requests'

type Lease = {
  operation: AgentHubOrbOperation
  controller: AbortController
  timer: ReturnType<typeof setTimeout> | NodeJS.Timeout
  event: AgentHubProgress
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

  constructor(private readonly publish: (event: AgentHubProgress) => void) {}

  snapshot(): AgentHubProgress[] {
    return [...this.active.values()].map((lease) => lease.event)
  }

  assertWritable(target: AgentHubOrbOperationTarget): void {
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
      if (sameTarget(lease.operation.target, target) && caller !== lease) {
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
    this.assertWritable(target)
    const operation: AgentHubOrbOperation = {
      id: randomUUID(),
      sessionId,
      target,
      method,
      active: true
    }
    const controller = new AbortController()
    const now = Date.now()
    const paneKey = `orb-operation:${operation.id}`
    const lease: Lease = {
      operation,
      controller,
      // Orphan recovery only; normal release follows the actual operation's completion.
      timer: setTimeout(() => this.release(operation.id), 120_000),
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
        expiresAt: now + 120_000,
        text: 'Orb is working here',
        orbOperation: operation
      }
    }
    if (typeof lease.timer !== 'number') {
      lease.timer.unref()
    }
    const cancel = () => this.release(operation.id)
    this.active.set(operation.id, lease)
    signal?.addEventListener('abort', cancel, { once: true })
    try {
      this.publish(lease.event)
      if (signal?.aborted) {
        cancel()
      }
      return await this.current.run(lease, async () => {
        this.assertWritable(target)
        return action(signal ? AbortSignal.any([signal, controller.signal]) : controller.signal)
      })
    } finally {
      signal?.removeEventListener('abort', cancel)
      this.release(operation.id)
    }
  }

  release(id: string): boolean {
    const lease = this.active.get(id)
    if (!lease) {
      return false
    }
    this.active.delete(id)
    clearTimeout(lease.timer)
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
