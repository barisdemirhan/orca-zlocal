import { useCallback, useEffect, useMemo, useState } from 'react'

export const AGENT_HUB_ORB_CAPTION_MS = 60_000

export function useAgentHubOrbCaptionVisibility({
  open,
  text,
  engaged,
  durationMs = AGENT_HUB_ORB_CAPTION_MS
}: {
  open: boolean
  text: string
  engaged: boolean
  durationMs?: number
}): { visible: boolean; restore: () => void } {
  const [restoreCount, setRestoreCount] = useState(0)
  // Speech, pointer and focus transitions each begin a new visibility cycle.
  const cycle = useMemo(
    () => ({ open, text, engaged, restoreCount }),
    [open, text, engaged, restoreCount]
  )
  const [expiredCycle, setExpiredCycle] = useState<typeof cycle | null>(null)
  const visible = open && text.trim().length > 0 && expiredCycle !== cycle
  useEffect(() => {
    if (!visible || engaged) {
      return
    }
    const timer = setTimeout(() => setExpiredCycle(cycle), durationMs)
    return () => clearTimeout(timer)
  }, [cycle, durationMs, engaged, visible])
  const restore = useCallback(() => setRestoreCount((count) => count + 1), [])
  return { visible, restore }
}
