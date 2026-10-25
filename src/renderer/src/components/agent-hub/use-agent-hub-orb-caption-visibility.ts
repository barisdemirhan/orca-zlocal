import { useCallback, useEffect, useMemo, useState } from 'react'

export const AGENT_HUB_ORB_CAPTION_MS = 60_000

export function useAgentHubOrbCaptionVisibility({
  open,
  text,
  engaged,
  pinned = false,
  durationMs = AGENT_HUB_ORB_CAPTION_MS
}: {
  open: boolean
  text: string
  engaged: boolean
  // Why: a pending decision stays on the sphere until it is answered, with or without text.
  pinned?: boolean
  durationMs?: number
}): { visible: boolean; restore: () => void } {
  const [restoreCount, setRestoreCount] = useState(0)
  // Speech, pointer and focus transitions each begin a new visibility cycle.
  const cycle = useMemo(
    () => ({ open, text, engaged, pinned, restoreCount }),
    [open, text, engaged, pinned, restoreCount]
  )
  const [expiredCycle, setExpiredCycle] = useState<typeof cycle | null>(null)
  const visible = open && (pinned || (text.trim().length > 0 && expiredCycle !== cycle))
  useEffect(() => {
    if (!visible || engaged || pinned) {
      return
    }
    const timer = setTimeout(() => setExpiredCycle(cycle), durationMs)
    return () => clearTimeout(timer)
  }, [cycle, durationMs, engaged, pinned, visible])
  const restore = useCallback(() => setRestoreCount((count) => count + 1), [])
  return { visible, restore }
}
