import { useCallback, useEffect, useMemo, useState } from 'react'

export function useAgentHubOrbCaptionVisibility({
  open,
  text,
  engaged
}: {
  open: boolean
  text: string
  engaged: boolean
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
    const timer = setTimeout(() => setExpiredCycle(cycle), 60_000)
    return () => clearTimeout(timer)
  }, [cycle, engaged, visible])
  const restore = useCallback(() => setRestoreCount((count) => count + 1), [])
  return { visible, restore }
}
