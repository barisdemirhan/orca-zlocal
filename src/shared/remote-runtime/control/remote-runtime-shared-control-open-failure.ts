import type { SharedControlSocketGeneration } from './remote-runtime-shared-control-socket-generation'
import * as sharedControlState from './remote-runtime-shared-control-state'
import type { SharedControlReadyWaiter } from './remote-runtime-shared-control-types'

/** Returns whether the failure belongs to the current socket attempt; a stale one is dropped. */
export function rejectSharedControlOpenFailure(
  socketGeneration: SharedControlSocketGeneration,
  generation: number,
  readyWaiters: SharedControlReadyWaiter[],
  error: unknown
): boolean {
  if (!socketGeneration.isCurrent(generation)) {
    return false
  }
  sharedControlState.rejectSharedControlReadyWaiters(
    readyWaiters,
    error instanceof Error ? error : new Error(String(error))
  )
  return true
}
