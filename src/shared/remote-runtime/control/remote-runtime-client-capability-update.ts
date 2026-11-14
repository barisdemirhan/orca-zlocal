import type { RuntimeCapability } from '../../protocol-version'
import type { RuntimeRpcResponse } from '../../runtime-rpc-envelope'
import { ClientCapabilitiesUpdate } from '../../rpc-contract/host-management/runtime-client-capabilities-params'

export function retainRemoteRuntimeClientCapabilityUpdate<TResult>(
  options: { clientCapabilities?: readonly RuntimeCapability[] },
  method: string,
  params: unknown
): (response: RuntimeRpcResponse<TResult>) => RuntimeRpcResponse<TResult> {
  return (response) => {
    if (method === 'runtime.clientCapabilities.update' && response.ok) {
      const update = ClientCapabilitiesUpdate.safeParse(params)
      if (update.success) {
        // Why: replayed subscriptions need the same capability set after a socket reconnect.
        options.clientCapabilities = update.data.clientCapabilities
      }
    }
    return response
  }
}
