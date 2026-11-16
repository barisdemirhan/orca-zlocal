import { isRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import type { IPtyProvider } from '../../../providers/pty/provider-contract'
import { getProviderForPty, resolvePtyExecutionHost } from '../provider/registry'
import type { PtyRuntimeControllerDeps } from './controller-deps'

const settledLocalPtyProviderStartups = new WeakSet<Promise<void>>()
const watchedLocalPtyProviderStartups = new WeakSet<Promise<void>>()

function readReadyPtyProvider(
  deps: PtyRuntimeControllerDeps,
  ptyId: string,
  read: (provider: IPtyProvider) => boolean | null
): boolean | null {
  try {
    // A local provider cannot prove remote-host absence.
    if (isRemoteRuntimePtyId(ptyId)) {
      return null
    }
    const startupPromise = deps.getLocalPtyProviderStartupPromise(resolvePtyExecutionHost(ptyId))
    if (startupPromise && !settledLocalPtyProviderStartups.has(startupPromise)) {
      // Sync probes cannot await daemon handoff; report unknown until it settles (docs/reference/ssh-execution-boundary.md).
      if (!watchedLocalPtyProviderStartups.has(startupPromise)) {
        watchedLocalPtyProviderStartups.add(startupPromise)
        const markSettled = (): void => {
          settledLocalPtyProviderStartups.add(startupPromise)
        }
        startupPromise.then(markSettled, markSettled)
      }
      return null
    }
    return read(getProviderForPty(ptyId))
  } catch {
    return null
  }
}

export function hasPtyFromRuntimeController(deps: PtyRuntimeControllerDeps, ptyId: string) {
  return readReadyPtyProvider(deps, ptyId, (provider) => provider.hasPty?.(ptyId) ?? null)
}

export function getPtyAvailabilityFromRuntimeController(
  deps: PtyRuntimeControllerDeps,
  ptyId: string
): boolean | null {
  return readReadyPtyProvider(
    deps,
    ptyId,
    (provider) => provider.getPtyAvailability?.(ptyId) ?? null
  )
}
