import { pairedHostClientCapabilities } from './rpc/targets/paired-host-client-capabilities'

type Lease = { consumers: number; queue: Promise<void> }
const leases = new Map<string, Lease>()

export function retainAgentHubConsumerCapability(
  environmentId: string,
  pairingRevision: number | undefined
): {
  ready: Promise<void>
  release: () => Promise<void>
} {
  const key = `${environmentId}\u0000${pairingRevision}`
  let lease = leases.get(key)
  if (!lease) {
    lease = { consumers: 0, queue: Promise.resolve() }
    leases.set(key, lease)
  }
  const current = lease
  const update = (enabled: boolean): Promise<void> => {
    current.queue = current.queue
      .catch(() => {})
      .then(async () => {
        const response = await window.api.runtimeEnvironments.call({
          selector: environmentId,
          method: 'runtime.clientCapabilities.update',
          params: { clientCapabilities: [...pairedHostClientCapabilities(enabled)] },
          expectedEnvironmentPairingRevision: pairingRevision
        })
        if (!response.ok) {
          throw response.error
        }
      })
    return current.queue
  }
  current.consumers += 1
  const ready = current.consumers === 1 ? update(true) : current.queue
  let released = false
  return {
    ready,
    release: () => {
      if (released) {
        return current.queue
      }
      released = true
      current.consumers -= 1
      if (current.consumers !== 0) {
        return current.queue
      }
      const withdrawal = update(false)
      void withdrawal
        .finally(() => {
          if (current.consumers === 0 && leases.get(key) === current) {
            leases.delete(key)
          }
        })
        .catch(() => {})
      return withdrawal
    }
  }
}

export function isAgentHubUnsupportedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (('code' in error &&
      ['method_not_found', 'unknown_method', 'unsupported_method'].includes(String(error.code))) ||
      ('message' in error && error.message === 'client_capabilities_update_unsupported'))
  )
}
