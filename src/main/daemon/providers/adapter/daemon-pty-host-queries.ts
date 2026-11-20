import type {
  TerminalSuspensionOptions,
  TerminalSuspensionResult
} from '../../../../shared/terminal-suspension'
import type { DeveloperPermissionStatus } from '../../../../shared/app-lifecycle/permissions/developer-permissions-types'
import {
  AUTOMATIC_WORK_RESUME_UNSUPPORTED,
  type AutomaticWorkResumeOutcome,
  type AutomaticWorkResumeResult,
  type AutomaticWorkStatus
} from '../../../../shared/terminal/pty/admission/spawn-admission-contract'
import { isUnknownRequestTypeError } from '../../endpoint/identity/daemon-endpoint-errors'
import type { AutomaticWorkRequestType } from '../../admission/daemon-automatic-work-protocol'
import type {
  DaemonAsyncIoHealth,
  DaemonAsyncIoStatus
} from '../../../../shared/terminal/daemon/daemon-async-io-health'
import { observeDaemonAsyncIoHealth } from '../../observability/daemon-async-io-telemetry-event'
import { sameEndpointIdentity } from '../../endpoint/identity/daemon-endpoint-incarnation'
import { DaemonPtyPreservedHostLoss } from './daemon-pty-preserved-host-loss'

export abstract class DaemonPtyHostQueries extends DaemonPtyPreservedHostLoss {
  async terminalSuspension(
    id: string,
    options: TerminalSuspensionOptions
  ): Promise<TerminalSuspensionResult> {
    try {
      return await this.client.request('terminalSuspension', { sessionId: id, ...options }, 5_000)
    } catch (error) {
      return { state: isUnknownRequestTypeError(error) ? 'unsupported' : 'unverifiable' }
    }
  }
  async getAsyncIoHealth(): Promise<DaemonAsyncIoStatus> {
    if (!this.client.isConnected()) {
      return { state: 'unverifiable' }
    }
    const identity = this.client.getDaemonIdentity()
    try {
      const health = await this.client.request<unknown>('asyncIoHealth', undefined, 7_000)
      if (
        health &&
        typeof health === 'object' &&
        'state' in health &&
        (health.state === 'healthy' || health.state === 'stalled') &&
        'pendingMs' in health &&
        typeof health.pendingMs === 'number' &&
        Number.isFinite(health.pendingMs) &&
        health.pendingMs >= 0
      ) {
        const result: DaemonAsyncIoHealth = { state: health.state, pendingMs: health.pendingMs }
        // A reply that crossed a reconnect cannot be attributed to either incarnation.
        const current = this.client.getDaemonIdentity()
        if (identity && current && sameEndpointIdentity(identity, current)) {
          observeDaemonAsyncIoHealth(identity, this.protocolVersion, result)
        }
        return result
      }
    } catch (error) {
      if (isUnknownRequestTypeError(error)) {
        return { state: 'unsupported' }
      }
    }
    return { state: 'unverifiable' }
  }

  async getFullDiskAccessStatus(): Promise<DeveloperPermissionStatus> {
    if (!this.client.isConnected()) {
      return 'unknown'
    }
    try {
      const result = await this.client.request<unknown>('fullDiskAccessStatus', undefined, 3000)
      if (result && typeof result === 'object' && 'status' in result) {
        const { status } = result
        if (status === 'granted' || status === 'denied' || status === 'unsupported') {
          return status
        }
      }
    } catch {
      // Older daemons and lost host contact cannot establish a permission verdict.
    }
    return 'unknown'
  }

  async getAutomaticWorkStatus(): Promise<AutomaticWorkStatus | null> {
    const status = await this.requestAutomaticWork<AutomaticWorkStatus>('automaticWorkStatus')
    return status === AUTOMATIC_WORK_RESUME_UNSUPPORTED ? null : status
  }

  resumeAutomaticWork(): Promise<AutomaticWorkResumeOutcome> {
    return this.requestAutomaticWork<AutomaticWorkResumeResult>('resumeAutomaticWork')
  }

  private async requestAutomaticWork<T>(
    type: AutomaticWorkRequestType
  ): Promise<T | typeof AUTOMATIC_WORK_RESUME_UNSUPPORTED> {
    await this.ensureConnected()
    try {
      return await this.client.request<T>(type, undefined)
    } catch (error) {
      // Unsupported requests cannot prove a recorded pause is absent.
      if (isUnknownRequestTypeError(error)) {
        return AUTOMATIC_WORK_RESUME_UNSUPPORTED
      }
      throw error
    }
  }

  async closeStartupQueryAuthority(id: string): Promise<number> {
    if (!this.supportsStartupIngress) {
      return 0
    }
    const result = await this.client.request<{ appliedSeq: number }>('closeStartupQueryAuthority', {
      sessionId: id
    })
    return result.appliedSeq
  }
}
