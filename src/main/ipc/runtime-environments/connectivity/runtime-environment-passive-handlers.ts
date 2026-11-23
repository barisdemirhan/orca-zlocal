import {
  manuallyDisconnectedResponse,
  runtimeEnvironmentCallFailure
} from '../requests/runtime-environment-call-failure'
import { desktopChatCreationHistory } from '../../../runtime/client/navigation/desktop-chat-creation-history'
import { ipcMain } from 'electron'
import { resolveEnvironment } from '../../../../shared/remote-runtime/host-store/runtime-environment-store'
import type {
  RuntimeOrchestrationEnvelope,
  RuntimeRpcResponse
} from '../../../../shared/remote-runtime/rpc/runtime-rpc-envelope'
import type { RuntimeStatus } from '../../../../shared/remote-runtime/session-graph/runtime-session-contracts'
import { isRuntimeEnvironmentManuallyDisconnected } from './runtime-environment-manual-disconnect'
import { callRuntimeEnvironment } from '../requests/runtime-environment-transport-routing'
import { rendererOrchestrationEnvelope } from '../connections/runtime-environment-shared-control-envelope'
import { getRuntimeEnvironmentStatus } from '../status/runtime-environment-status-probe'
import { withWslOrcadAccountEnv } from '../../../wsl/orcad/wsl-orcad-account-env'
import {
  observeWslOrcadHostResponse,
  wslOrcadHostSupports
} from '../../../wsl/orcad/wsl-orcad-host-environments'
import {
  isHostSpawnFencedForWslMoveUndo,
  wslMoveUndoSpawnFencedResponse
} from '../../../persistence/moving-wsl-projects/cutover-recovery/wsl-move-undo-spawn-fence'

export function registerRuntimeEnvironmentPassiveHandlers(
  getUserDataPath: () => string,
  recordAnswer?: RecordRuntimeEnvironmentAnswer
): void {
  registerPassiveStatusHandler(getUserDataPath)
  registerPassiveCallHandler(getUserDataPath, recordAnswer)
}

function registerPassiveStatusHandler(getUserDataPath: () => string): void {
  ipcMain.handle(
    'runtimeEnvironments:getStatus',
    async (
      _event,
      args: { selector: string; timeoutMs?: number; observeOnly?: true; force?: true }
    ): Promise<RuntimeRpcResponse<RuntimeStatus>> => {
      const environment = await resolveEnvironment(getUserDataPath(), args.selector)
      if (isRuntimeEnvironmentManuallyDisconnected(environment.id)) {
        return manuallyDisconnectedResponse(environment)
      }
      const response = await getRuntimeEnvironmentStatus(
        getUserDataPath(),
        environment.id,
        args.timeoutMs,
        { observeOnly: args.observeOnly, force: args.force }
      )
      observeWslOrcadHostResponse(environment.id, 'status.get', response)
      return isRuntimeEnvironmentManuallyDisconnected(environment.id)
        ? manuallyDisconnectedResponse(environment)
        : response
    }
  )
}

type RecordRuntimeEnvironmentAnswer = (
  environment: Awaited<ReturnType<typeof resolveEnvironment>>,
  method: string,
  response: RuntimeRpcResponse<unknown>
) => void

function registerPassiveCallHandler(
  getUserDataPath: () => string,
  recordAnswer?: RecordRuntimeEnvironmentAnswer
): void {
  ipcMain.handle(
    'runtimeEnvironments:call',
    async (
      _event,
      args: {
        envelope?: RuntimeOrchestrationEnvelope
        selector: string
        method: string
        params?: unknown
        timeoutMs?: number
        expectedEnvironmentPairingRevision?: number
        expectedEnvironmentRuntimeId?: string
        background?: boolean
        wake?: boolean
      }
    ): Promise<RuntimeRpcResponse<unknown>> => {
      const environment = await resolveEnvironment(getUserDataPath(), args.selector)
      if (isRuntimeEnvironmentManuallyDisconnected(environment.id)) {
        return manuallyDisconnectedResponse(environment)
      }
      if (isHostSpawnFencedForWslMoveUndo(environment.id, args.method)) {
        return wslMoveUndoSpawnFencedResponse(environment, args.method)
      }
      void desktopChatCreationHistory(getUserDataPath()).recordCreate(
        environment.id,
        args.method,
        args.params
      )
      // Every renderer request to a paired host passes this account environment boundary.
      const accounts = await withWslOrcadAccountEnv({
        environmentId: environment.id,
        method: args.method,
        params: args.params,
        hostSupports: (capability) =>
          wslOrcadHostSupports(environment.id, capability, () =>
            callRuntimeEnvironment(
              getUserDataPath(),
              environment.id,
              'status.get',
              undefined,
              undefined,
              undefined,
              undefined,
              { wake: args.wake === true }
            )
          )
      })
      if (!accounts.ok) {
        return {
          id: args.method,
          ok: false,
          error: { code: 'account_preparation_failed', message: accounts.message },
          _meta: { runtimeId: environment.runtimeId }
        }
      }
      let response: RuntimeRpcResponse<unknown>
      try {
        response = await callRuntimeEnvironment(
          getUserDataPath(),
          environment.id,
          args.method,
          accounts.params,
          args.timeoutMs,
          args.expectedEnvironmentPairingRevision,
          args.envelope ?? rendererOrchestrationEnvelope(args.method, accounts.params),
          {
            expectedEnvironmentRuntimeId: args.expectedEnvironmentRuntimeId,
            background: args.background === true,
            wake: args.wake === true
          }
        )
      } catch (error) {
        const failure = runtimeEnvironmentCallFailure(environment, args.method, error)
        if (failure) {
          return failure
        }
        throw error
      }
      observeWslOrcadHostResponse(environment.id, args.method, response)
      recordAnswer?.(environment, args.method, response)
      return isRuntimeEnvironmentManuallyDisconnected(environment.id)
        ? manuallyDisconnectedResponse(environment)
        : response
    }
  )
}
