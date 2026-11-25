import { useEffect, useEffectEvent, useState } from 'react'

export const BOT_RESULT_VISIBLE_MS = 7000
export const BOT_FAILURE_VISIBLE_MS = 12_000
export const BOT_ANSWERED_VISIBLE_MS = 1800

/**
 * How long a bubble stays: `ms` null keeps it until answered or dismissed. Hovering or focusing
 * inside pauses the countdown, and leaving restarts it; `pausable` false (an Answered flash) never waits.
 */
export function useAgentHubBotBubbleLifetime(
  key: string,
  ms: number | null,
  pausable: boolean,
  onClose: () => void
): React.HTMLAttributes<HTMLDivElement> {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const close = useEffectEvent(onClose)
  const held = pausable && (hovered || focused)
  useEffect(() => {
    if (ms === null || held) {
      return
    }
    const timer = setTimeout(() => close(), ms)
    return () => clearTimeout(timer)
  }, [key, ms, held])
  return {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setFocused(false)
      }
    }
  }
}
