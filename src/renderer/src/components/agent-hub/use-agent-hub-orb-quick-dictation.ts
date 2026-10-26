import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '@/store'
import { normalizeAgentHubMicMode } from '../../../../shared/agent-hub-settings'
import {
  DICTATION_CONTROL_EVENT,
  dispatchDictationControl
} from '../dictation/dictation-control-events'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { startAgentHubDictation } from './agent-hub-dictation-improve'
import { isDictationRunning } from './agent-hub-mirror-mic-state'

/** The last transcript segment lands after the recording ends; wait for the box to go quiet. */
export const AGENT_HUB_ORB_QUICK_SETTLE_MS = 500
const AGENT_HUB_ORB_QUICK_START_MS = 2_000
export const AGENT_HUB_ORB_QUICK_MISSED_MS = 4_000

export type AgentHubOrbQuickDictationPhase = 'starting' | 'listening' | 'finishing'

export type AgentHubOrbQuickDictation = {
  active: boolean
  /** Null while no recording runs; 'starting' until the controller is actually listening. */
  phase: AgentHubOrbQuickDictationPhase | null
  /** A finished recording left the box empty. */
  missed: boolean
  start: () => void
  stop: () => void
  onInput: () => void
  onKeyDown: () => void
}

/** Dictation into the one-line box: the box is the insertion target and a finished recording sends itself. */
export function useAgentHubOrbQuickDictation({
  inputRef,
  prepare,
  onSend
}: {
  inputRef: RefObject<HTMLInputElement | null>
  prepare: () => Promise<boolean>
  onSend: () => void
}): AgentHubOrbQuickDictation {
  const [active, setActive] = useState(false)
  const [missed, setMissed] = useState(false)
  const dictationState = useAppStore((s) => s.dictationState)
  const starting = useRef(false)
  const stopWhenStarted = useRef(false)
  const seenRunning = useRef(false)
  const cancelled = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSend = useRef(onSend)
  latestSend.current = onSend
  const clearSettle = useCallback((): void => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
  }, [])
  const armSettle = useCallback((): void => {
    clearSettle()
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null
      if (inputRef.current?.value.trim()) {
        latestSend.current()
      } else {
        setMissed(true)
      }
    }, AGENT_HUB_ORB_QUICK_SETTLE_MS)
  }, [clearSettle, inputRef])
  useEffect(() => {
    if (!active) {
      return
    }
    if (isDictationRunning(dictationState)) {
      seenRunning.current = true
      return
    }
    if (seenRunning.current) {
      seenRunning.current = false
      setActive(false)
      if (!cancelled.current) {
        armSettle()
      }
      return
    }
    // Why: the controller answers a start asynchronously; one it never answers must not stick.
    const timer = setTimeout(() => setActive(false), AGENT_HUB_ORB_QUICK_START_MS)
    return () => clearTimeout(timer)
  }, [active, dictationState, armSettle])
  useEffect(() => {
    if (!missed) {
      return
    }
    const timer = setTimeout(() => setMissed(false), AGENT_HUB_ORB_QUICK_MISSED_MS)
    return () => clearTimeout(timer)
  }, [missed])
  // Why: a thrown-away recording leaves its words in the box, but they must not send themselves.
  useEffect(() => {
    const control = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail === 'cancel') {
        cancelled.current = true
      }
    }
    document.addEventListener(DICTATION_CONTROL_EVENT, control)
    return () => document.removeEventListener(DICTATION_CONTROL_EVENT, control)
  }, [])
  useEffect(
    () => () => {
      clearSettle()
      if (seenRunning.current && isDictationRunning(useAppStore.getState().dictationState)) {
        cancelDictation()
      }
    },
    [clearSettle]
  )
  const start = useCallback((): void => {
    if (active || starting.current || isDictationRunning(useAppStore.getState().dictationState)) {
      return
    }
    starting.current = true
    setMissed(false)
    stopWhenStarted.current = false
    cancelled.current = false
    void prepare().then((ready) => {
      // Why: the box may have opened in this same tick; focus needs it painted to take.
      requestAnimationFrame(() => {
        starting.current = false
        const input = inputRef.current
        if (!ready || !input) {
          return
        }
        input.focus({ preventScroll: true })
        setActive(true)
        startAgentHubDictation(
          normalizeAgentHubMicMode(useAppStore.getState().settings?.agentHubMicMode) === 'improve'
        )
        if (stopWhenStarted.current) {
          dispatchDictationControl('stop')
        }
      })
    })
  }, [active, inputRef, prepare])
  const stop = useCallback((): void => {
    if (starting.current) {
      stopWhenStarted.current = true
    } else if (active) {
      dispatchDictationControl('stop')
    }
  }, [active])
  const onInput = useCallback((): void => {
    if (settleTimer.current !== null) {
      armSettle()
    }
  }, [armSettle])
  // Why: speech before the mic opens is lost, so "Listening" waits for the controller.
  const phase = !active
    ? null
    : dictationState === 'listening'
      ? 'listening'
      : dictationState === 'idle' || dictationState === 'starting'
        ? 'starting'
        : 'finishing'
  return { active, phase, missed, start, stop, onInput, onKeyDown: clearSettle }
}
