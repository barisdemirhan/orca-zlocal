import { useEffect, useState } from 'react'

const FLOATING_PANEL = '[data-floating-terminal-panel]'
const MIRROR_SURFACE = '[data-agent-hub-mirror], [data-agent-hub-mirror-tray]'

/**
 * Whether Orca's floating workspace was used last, so it comes over the mirrors the way a
 * clicked mirror comes over the others. A mirror used (or opened) afterwards takes the front back.
 */
export function useFloatingPanelInFront(openMirrorCount: number): boolean {
  const [panelInFront, setPanelInFront] = useState(false)
  useEffect(() => {
    const onUse = (event: Event): void => {
      if (!(event.target instanceof Element)) {
        return
      }
      if (event.target.closest(FLOATING_PANEL)) {
        setPanelInFront(true)
      } else if (event.target.closest(MIRROR_SURFACE)) {
        setPanelInFront(false)
      }
    }
    window.addEventListener('pointerdown', onUse, true)
    window.addEventListener('focusin', onUse, true)
    return () => {
      window.removeEventListener('pointerdown', onUse, true)
      window.removeEventListener('focusin', onUse, true)
    }
  }, [])
  // A mirror opened from the hub lands in front.
  const [seenCount, setSeenCount] = useState(openMirrorCount)
  if (openMirrorCount !== seenCount) {
    setSeenCount(openMirrorCount)
    if (openMirrorCount > seenCount) {
      setPanelInFront(false)
    }
  }
  return panelInFront
}
