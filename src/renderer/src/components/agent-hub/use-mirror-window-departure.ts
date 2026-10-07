import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { AgentHubMirrorWindowState } from './agent-hub-mirror-membership'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { flyMirrorWindowToHub } from './mirror-window-flight'

export function useMirrorWindowDeparture(
  windowId: string,
  membership: AgentHubMirrorWindowState | undefined,
  section: RefObject<HTMLElement | null>,
  hub: RefObject<HTMLElement | null>,
  onMinimize: () => void
) {
  const [leaving, setLeaving] = useState(false)
  const minimizing = useRef(false)
  const token = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelFlight = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    token.current += 1
    minimizing.current = false
    setLeaving(false)
    return () => {
      token.current += 1
      if (timer.current) {
        clearTimeout(timer.current)
      }
      cancelFlight.current?.()
      cancelFlight.current = null
    }
  }, [windowId, membership])
  const guard = (callback: () => void): (() => void) => {
    const capturedToken = ++token.current
    const snapshot = readAgentHubMirrors().windows.find((window) => window.id === windowId)
    return () => {
      if (
        token.current === capturedToken &&
        snapshot &&
        readAgentHubMirrors().windows.find((window) => window.id === windowId) === snapshot
      ) {
        callback()
      }
    }
  }
  const leave = (callback: () => void): void => {
    if (timer.current) {
      clearTimeout(timer.current)
    }
    setLeaving(true)
    timer.current = setTimeout(guard(callback), 140)
  }
  const minimize = (delayMs = 0): void => {
    if (minimizing.current || !section.current) {
      return
    }
    minimizing.current = true
    cancelFlight.current = flyMirrorWindowToHub(
      section.current,
      hub.current,
      guard(onMinimize),
      Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0
    )
  }
  return { leaving, minimizing, leave, minimize }
}
