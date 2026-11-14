import { useCallback, useLayoutEffect, useRef } from 'react'
import { useAppStore } from '../../../../../store/index'
import { sendRuntimePtyInput } from '@/runtime/hosted-terminals/input/runtime-terminal-input-send'
import { sendRuntimePtyInputVerified } from '@/runtime/hosted-terminals/input/runtime-terminal-verified-input'
import type { AgentType } from '../../../../../../../shared/agent-status/contracts/agent-status-types'
import {
  nativeChatAskRequiresTerminal,
  nativeChatStopSendsSecondEscape,
  resolveNativeChatTranscriptAgent,
  shouldStepNativeChatAskAnswer
} from '../../../../../../../shared/native-chat/native-chat-agent-support'
import {
  buildAskAnswerKeys,
  buildCodexAskAnswerKeys,
  formatAskAnswer,
  hasAskAnswer,
  type AskAnswerSelection
} from '../../../../../../../shared/native-chat/input/native-chat-ask-answer'
import type { AskPrompt } from '../../../../../../../shared/native-chat/input/native-chat-ask-types'
import {
  sendNativeChatAskAnswer,
  sendNativeChatMessage,
  type NativeChatSendHandle
} from './native-chat-runtime-send'
import { inferQuestionAnsweredFromCurrentStatus } from '../../../../terminal-pane/agent-status/input-inference/agent-question-answered-inference'
import { createAgentInterruptInference } from '../../../../terminal-pane/agent-status/input-inference/agent-interrupt-inference'

// Agent TUIs use Escape to cancel questions or deny approvals.
const ESC = '\x1b'

export type NativeChatInteractiveSend = {
  /** Claude-format selector answers settle only after every runtime write is verified. */
  sendAnswer: (
    prompt: AskPrompt,
    selections: AskAnswerSelection[],
    onDeliverySettled?: (delivered: boolean) => void
  ) => { settleAfterMs: number }
  /** Send a raw control string (e.g. an approval option number or ESC) as-is. */
  sendRaw: (raw: string) => void
  /** `sendRaw` that resolves to whether the write was acknowledged; unknown delivery is false. A startup-dialog choice names its card so the host can refuse a stale one. */
  sendRawVerified: (raw: string, requireStartupDialog?: string) => Promise<boolean>
  /** Stop delayed writes without interrupting the agent. */
  cancelPending: () => void
  /** Reject the active question without requesting session interruption; resolves to whether
   *  the Escape was acknowledged. */
  cancelAsk: () => Promise<boolean>
  /** Interrupt the active turn. */
  cancel: () => void
}

/**
 * Reuse the desktop composer's exact send path for the interactive cards:
 * resolve this tab's live ptyId + runtime owner settings, then write bytes via
 * `sendRuntimePtyInput` (which branches local pty:write vs remote runtime RPC,
 * so SSH panes work unchanged). Selector answers use their respective
 * selector keystrokes via `sendNativeChatAskAnswer`; other agents still go through
 * `sendNativeChatMessage`. Control strings (option digits, ESC) are written raw.
 */
export function useNativeChatInteractiveSend(
  paneKey: string,
  targetPtyId: string | null,
  agent: AgentType,
  options: {
    /** Let a chosen answer finish its paced writes after a short-lived card unmounts. */
    finishAnswerAfterUnmount?: boolean
  } = {}
): NativeChatInteractiveSend {
  // The in-flight answer's cancel handle; cleared on a new send, on Stop, and on
  // unmount so a detached setTimeout chain can't keep writing PTY bytes after
  // the view is gone / the user switched away.
  const inFlightRef = useRef<NativeChatSendHandle | null>(null)
  const cancelInFlight = useCallback(() => {
    inFlightRef.current?.cancel()
    inFlightRef.current = null
  }, [])
  // Why: a split can be rebound without unmounting this view. Cancel during
  // commit so no delayed answer write can race the replacement PTY.
  const bindingRef = useRef<string | null>(null)
  useLayoutEffect(() => {
    const binding = JSON.stringify([agent, paneKey, targetPtyId])
    if (bindingRef.current !== null && bindingRef.current !== binding) {
      cancelInFlight()
    }
    bindingRef.current = binding
  }, [agent, cancelInFlight, paneKey, targetPtyId])
  const { finishAnswerAfterUnmount = false } = options
  useLayoutEffect(
    () => () => {
      if (!finishAnswerAfterUnmount) {
        cancelInFlight()
      }
    },
    [cancelInFlight, finishAnswerAfterUnmount]
  )

  const sendRaw = useCallback(
    (raw: string) => {
      if (!targetPtyId) {
        return
      }
      sendRuntimePtyInput(targetPtyId, raw, 'driving')
    },
    [targetPtyId]
  )

  const sendRawVerified = useCallback(
    (raw: string, requireStartupDialog?: string): Promise<boolean> =>
      targetPtyId
        ? sendRuntimePtyInputVerified(targetPtyId, raw, 'driving', {
            requireWriteSettlement: true,
            ...(requireStartupDialog !== undefined ? { requireStartupDialog } : {})
          }).catch(() => false)
        : Promise.resolve(false),
    [targetPtyId]
  )

  const sendAnswer = useCallback(
    (
      prompt: AskPrompt,
      selections: AskAnswerSelection[],
      onDeliverySettled?: (delivered: boolean) => void
    ): { settleAfterMs: number } => {
      if (nativeChatAskRequiresTerminal(agent)) {
        cancelInFlight()
        onDeliverySettled?.(false)
        return { settleAfterMs: 0 }
      }
      if (!targetPtyId || !hasAskAnswer(prompt, selections)) {
        return { settleAfterMs: 0 }
      }
      cancelInFlight()
      // Selector TUIs ignore pasted labels; Codex uses a different key sequence.
      const stepsAnswer = !prompt.replyAsMessage && shouldStepNativeChatAskAnswer(agent)
      const buildsCodexAnswer = resolveNativeChatTranscriptAgent(agent) === 'codex'
      // Capture the question baseline before paced/remote delivery so late settlement cannot clear a replacement question’s wait.
      const questionStatusBaseline = stepsAnswer
        ? useAppStore.getState().agentStatusByPaneKey[paneKey]
        : undefined
      let settledHandle: NativeChatSendHandle | null = null
      const onSettled = (delivered: boolean): void => {
        if (settledHandle && inFlightRef.current === settledHandle) {
          // Release completed sends’ timers, promises and prompt callbacks immediately.
          inFlightRef.current = null
        }
        if (delivered && stepsAnswer) {
          inferQuestionAnsweredFromCurrentStatus({
            paneKey,
            getStatusEntry: () => questionStatusBaseline,
            inferQuestionAnswered: (request) =>
              window.api.agentStatus.inferQuestionAnswered(request).catch((err) => {
                console.warn('[agent-question] native-chat inference failed:', err)
                return false
              })
          })
        }
        onDeliverySettled?.(delivered)
      }
      const handle: NativeChatSendHandle = stepsAnswer
        ? sendNativeChatAskAnswer(
            targetPtyId,
            buildsCodexAnswer
              ? buildCodexAskAnswerKeys(prompt, selections)
              : buildAskAnswerKeys(prompt, selections),
            onSettled
          )
        : sendNativeChatMessage(targetPtyId, formatAskAnswer(prompt, selections), {
            onDeliverySettled: onSettled
          })
      // These writes bypass xterm.onData; infer completion only after all paced steps so an early digit cannot dismiss the wait.
      settledHandle = handle
      inFlightRef.current = handle
      return {
        settleAfterMs: handle.settleAfterMs
      }
    },
    [paneKey, targetPtyId, agent, cancelInFlight]
  )

  const cancelAsk = useCallback(() => {
    cancelInFlight()
    if (nativeChatAskRequiresTerminal(agent)) {
      return Promise.resolve(false)
    }
    return sendRawVerified(ESC)
  }, [agent, cancelInFlight, sendRawVerified])

  const cancel = useCallback(() => {
    cancelInFlight()
    if (nativeChatStopSendsSecondEscape(agent) && targetPtyId) {
      // Pace the second Escape like an answer step so the TUI renders its confirm first.
      inFlightRef.current = sendNativeChatAskAnswer(targetPtyId, [{ raw: ESC }, { raw: ESC }])
      return
    }
    // Why: this Escape bypasses xterm.onData; infer like an acknowledged typed Escape, from the status before it.
    const statusBeforeEscape = useAppStore.getState().agentStatusByPaneKey[paneKey] ?? null
    void sendRawVerified(ESC).then((accepted) => {
      if (!accepted) {
        return
      }
      void createAgentInterruptInference({
        paneKey,
        getStatusEntry: () => useAppStore.getState().agentStatusByPaneKey[paneKey],
        inferInterrupt: (request) =>
          window.api.agentStatus.inferInterrupt(request).catch((err) => {
            console.warn('[agent-interrupt] native-chat inference failed:', err)
            return false
          })
      }).observeInputIntent('plain-escape', statusBeforeEscape)
    })
  }, [agent, cancelInFlight, paneKey, sendRawVerified, targetPtyId])

  return { sendAnswer, sendRaw, sendRawVerified, cancelPending: cancelInFlight, cancelAsk, cancel }
}
