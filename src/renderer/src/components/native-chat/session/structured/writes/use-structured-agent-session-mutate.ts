import { useNativeChatPaneLifetimeEffect } from '../../../pane/ownership/native-chat-pane-lifetime'
// Give each press its own operation ID; join pending targeted Stops only for older hosts. Command settlement survives provider changes; late pane presentation does not.

import { AGENT_SESSION_GOAL_CONTROL_COPY as GOAL_COPY } from '../../../../../../../shared/agent-session/view/agent-session-goal-control-copy'
import { agentSessionGoalControlWords } from '../../goals/agent-session-goal-control-words'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import type { AgentSessionMutationResult } from '../../../../../../../shared/agent-session/agent-session-wire'
import {
  agentSessionRefusalFailure,
  agentSessionThrownFailure,
  agentSessionWriteKindForMethod as writeKind,
  type AgentSessionWriteFailure
} from '../../../../../../../shared/agent-session/failures/agent-session-write-failure'
import { structuredAgentSessionPayloadFingerprint } from '../../../../../../../shared/agent-session/lifecycle/operations/structured-agent-session-mutation'
import { structuredSessionOperationId } from './structured-agent-session-operation-id'
import type { RuntimeClientTarget } from '../../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { RuntimeRpcCallError } from '@/runtime/rpc/calls/runtime-rpc-result'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { supportsStructuredAgentSessionQuietRepeatedStop } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-support'
import { structuredAgentSessionHostKey } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import { agentSessionWriteFailureText } from '../../../messages/notices/agent-session-write-notice-text'
import {
  joinStructuredAgentSessionStop,
  structuredAgentSessionStopIsJoinable
} from '../../../../../../../shared/agent-session/requests/structured-agent-session-stop-join'

export type StructuredAgentSessionWriteOutcome<T> =
  | { kind: 'done'; value: T }
  /** Refused or failed, with what to tell the person and the fact it was worded from. */
  | { kind: 'not-done'; notice: string; failure: AgentSessionWriteFailure }
  /** Unavailable at entry, so nothing was dispatched. */
  | { kind: 'dropped' }

type ExecutionResult<T> = StructuredAgentSessionWriteOutcome<T> & {
  reportFailure?: (notice: string) => void
}

export type StructuredAgentSessionVoiceStartObserver = {
  issued: (fence: number) => void
  confirmed: (fence: number) => void
}

type WriteArgs = [
  method: string,
  fingerprintMethod: string,
  fields: Record<string, unknown>,
  voiceStartObserver?: StructuredAgentSessionVoiceStartObserver
]

export type StructuredAgentSessionWrite = <T>(
  ...args: WriteArgs
) => Promise<StructuredAgentSessionWriteOutcome<T>>

/** A write whose failure is shown as a toast; the control that sent it is the way to try again. */
export type StructuredAgentSessionMutate = <T>(...args: WriteArgs) => Promise<T | null>

export type StructuredAgentSessionAction = {
  target: RuntimeClientTarget
  write: StructuredAgentSessionWrite
  mutate: StructuredAgentSessionMutate
}
export type AdmitStructuredAgentSessionAction = () => StructuredAgentSessionAction | null

/** Captures the issuing pane visit for late presentation, never command or draft settlement. */
export type CaptureStructuredAgentSessionPresentation = () => () => boolean

function notDone(
  failure: AgentSessionWriteFailure,
  fingerprintMethod: string,
  fields: Record<string, unknown>,
  agentName: string | undefined
): Extract<ExecutionResult<never>, { kind: 'not-done' }> {
  return {
    kind: 'not-done',
    notice: agentSessionWriteFailureText(
      failure,
      writeKind(fingerprintMethod, fields),
      agentName ? { agentName } : {}
    ),
    failure,
    reportFailure: toast.error
  }
}

function confirmsVoiceStart(value: unknown, fields: Record<string, unknown>): boolean {
  return (
    typeof fields.voiceSessionId === 'string' &&
    typeof fields.generation === 'number' &&
    typeof value === 'object' &&
    value !== null &&
    'voiceSessionId' in value &&
    value.voiceSessionId === fields.voiceSessionId &&
    'generation' in value &&
    value.generation === fields.generation &&
    'state' in value &&
    value.state === 'connecting'
  )
}

export function useStructuredAgentSessionMutate(args: {
  sessionId: string
  target: RuntimeClientTarget
  enabled?: boolean
  /** Capture the original press fence for host admission, including older hosts. */
  stateRef: { current: { fence: number | null } }
  agentName?: string
}): {
  write: StructuredAgentSessionWrite
  mutate: StructuredAgentSessionMutate
  admit: AdmitStructuredAgentSessionAction
  capturePresentation: CaptureStructuredAgentSessionPresentation
} {
  const { agentName, enabled = true, sessionId, stateRef, target } = args
  const inFlightStops = useRef(new Map<string, Promise<ExecutionResult<unknown>>>())
  const presentation = useRef<object | null>(null)
  const hostKey = structuredAgentSessionHostKey(target)
  const environmentId = target.kind === 'environment' ? target.environmentId : null
  const voiceOwner = useMemo(
    () => ({ sessionId, kind: target.kind, environmentId }),
    [sessionId, target.kind, environmentId]
  )
  const currentVoiceOwner = useRef<object | null>(voiceOwner)
  const latestVoiceStart = useRef<object | null>(null)
  useEffect(() => {
    currentVoiceOwner.current = voiceOwner
    latestVoiceStart.current = null
    return () => {
      currentVoiceOwner.current = null
      latestVoiceStart.current = null
    }
  }, [voiceOwner])
  useNativeChatPaneLifetimeEffect(
    useCallback(() => {
      presentation.current = enabled ? {} : null
      latestVoiceStart.current = null
      return () => {
        presentation.current = null
      }
    }, [enabled, hostKey, sessionId])
  )
  const capturePresentation = useCallback(() => {
    const visit = presentation.current
    return () => visit !== null && presentation.current === visit
  }, [])

  const send = useCallback(
    async <T>(
      method: string,
      fingerprintMethod: string,
      fields: Record<string, unknown>,
      /** The fence when the press happened, read before any await, so a write never retargets. */
      pressedFence: number,
      voiceStartObserver?: StructuredAgentSessionVoiceStartObserver
    ): Promise<ExecutionResult<T>> => {
      const voiceStart = method === 'agentSession.startVoice' && fingerprintMethod === method
      if (voiceStart && currentVoiceOwner.current !== voiceOwner) {
        return { kind: 'dropped' }
      }
      const request = {}
      if (voiceStart) {
        latestVoiceStart.current = request
        voiceStartObserver?.issued(pressedFence)
      }
      // Unlike other replies, a voice start answers only this owner's latest start at its fence.
      const voiceSettlesHere = (confirmedFence?: number): boolean => {
        const ownsStart =
          currentVoiceOwner.current === voiceOwner && latestVoiceStart.current === request
        if (latestVoiceStart.current === request) {
          latestVoiceStart.current = null
        }
        return (
          ownsStart &&
          presentation.current !== null &&
          stateRef.current.fence === (confirmedFence ?? pressedFence)
        )
      }
      let result: AgentSessionMutationResult<T>
      try {
        result = await callStructuredAgentSession<AgentSessionMutationResult<T>>(target, method, {
          envelope: {
            sessionId,
            clientOperationId: structuredSessionOperationId(),
            expectedRuntimeFence: pressedFence,
            payloadFingerprint: structuredAgentSessionPayloadFingerprint({
              method: fingerprintMethod,
              sessionId,
              fields
            })
          },
          ...fields
        })
      } catch (error) {
        if (voiceStart && !voiceSettlesHere()) {
          return { kind: 'dropped' }
        }
        return notDone(
          agentSessionThrownFailure(
            error,
            error instanceof RuntimeRpcCallError ? error.code : undefined
          ),
          fingerprintMethod,
          fields,
          agentName
        )
      }
      if (!result.ok) {
        if (voiceStart && !voiceSettlesHere()) {
          return { kind: 'dropped' }
        }
        const outcome = notDone(
          agentSessionRefusalFailure(result.refusal),
          fingerprintMethod,
          fields,
          agentName
        )
        const message = result.refusal.message
        if (
          fingerprintMethod === 'agentSession.threadGoal' &&
          (message === GOAL_COPY.settingsRejected ||
            message === GOAL_COPY.settingsUnconfirmed ||
            message === GOAL_COPY.noGoal)
        ) {
          outcome.notice = agentSessionGoalControlWords(message)
        }
        return outcome
      }
      if (voiceStart) {
        if (!Number.isSafeInteger(result.fence) || !confirmsVoiceStart(result.value, fields)) {
          voiceSettlesHere()
          return { kind: 'dropped' }
        }
        // Cleanup belongs to the issued voice even after its pane hides; its UI reply still drops.
        voiceStartObserver?.confirmed(result.fence)
        if (!voiceSettlesHere(result.fence)) {
          return { kind: 'dropped' }
        }
      }
      return { kind: 'done', value: result.value }
    },
    [agentName, sessionId, stateRef, target, voiceOwner]
  )

  const admit = useCallback((): StructuredAgentSessionAction | null => {
    const pressedFence = stateRef.current.fence
    if (!enabled || presentation.current === null || pressedFence === null) {
      return null
    }
    const isCurrent = capturePresentation()
    const execute = async <T>(
      method: string,
      fingerprintMethod: string,
      fields: Record<string, unknown>,
      voiceStartObserver?: StructuredAgentSessionVoiceStartObserver
    ): Promise<ExecutionResult<T>> => {
      if (
        !structuredAgentSessionStopIsJoinable(fingerprintMethod, fields) ||
        (await supportsStructuredAgentSessionQuietRepeatedStop(target))
      ) {
        return send<T>(method, fingerprintMethod, fields, pressedFence, voiceStartObserver)
      }
      // Older hosts lack quiet repeated Stops; retain joining until none remain supported.
      const key = `${hostKey}:${sessionId}:${method}:${JSON.stringify(fields)}`
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the key names the method and fields, so the joined promise is this very call and settles to its T.
      return joinStructuredAgentSessionStop(inFlightStops.current, key, () =>
        send<T>(method, fingerprintMethod, fields, pressedFence)
      ) as Promise<ExecutionResult<T>>
    }
    const mutate: StructuredAgentSessionMutate = async <T>(...writeArgs: WriteArgs) => {
      const outcome = await execute<T>(...writeArgs)
      if (outcome.kind === 'not-done' && isCurrent()) {
        const report = outcome.reportFailure
        outcome.reportFailure = undefined
        report?.(outcome.notice)
      }
      return outcome.kind === 'done' ? outcome.value : null
    }
    return { target, write: execute, mutate }
  }, [capturePresentation, enabled, hostKey, send, sessionId, stateRef, target])

  const write = useCallback(
    async <T>(...writeArgs: WriteArgs): Promise<StructuredAgentSessionWriteOutcome<T>> =>
      admit()?.write<T>(...writeArgs) ?? { kind: 'dropped' },
    [admit]
  )
  const mutate = useCallback(
    async <T>(...writeArgs: WriteArgs): Promise<T | null> =>
      admit()?.mutate<T>(...writeArgs) ?? null,
    [admit]
  )

  return { write, mutate, admit, capturePresentation }
}
