import { useEffect, useEffectEvent } from 'react'

export const BOT_RESULT_VISIBLE_MS = 7000
export const BOT_FAILURE_VISIBLE_MS = 12_000
export const BOT_ANSWERED_VISIBLE_MS = 1800

/** Why a plain timer: the stack owns hover and focus, so one pause covers every bubble in it. */
export function useAgentHubBotBubbleLifetime(
  key: string,
  ms: number | null,
  held: boolean,
  onClose: () => void
): void {
  const close = useEffectEvent(onClose)
  useEffect(() => {
    if (ms === null || held) {
      return
    }
    const timer = setTimeout(() => close(), ms)
    return () => clearTimeout(timer)
  }, [key, ms, held])
}
