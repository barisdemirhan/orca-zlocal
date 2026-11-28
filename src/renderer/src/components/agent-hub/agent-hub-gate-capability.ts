import type { AppState } from '@/store/types'
import { lastVerifiedRuntimeStatus } from '../../../../shared/remote-runtime/host-status/runtime-host-status'
import { ORCHESTRATION_USER_GATE_RESOLVE_RUNTIME_CAPABILITY } from '../../../../shared/orchestration/orchestration-runtime-capabilities'

export function agentHubCanResolveGate(state: AppState, host: string): boolean {
  return (
    host === 'local' ||
    Boolean(
      lastVerifiedRuntimeStatus(
        state.runtimeStatusByEnvironmentId.get(host)
      )?.capabilities?.includes(ORCHESTRATION_USER_GATE_RESOLVE_RUNTIME_CAPABILITY)
    )
  )
}
