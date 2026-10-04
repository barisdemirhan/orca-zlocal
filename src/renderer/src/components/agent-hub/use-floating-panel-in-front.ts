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
    const noteUse = (target: EventTarget | null): void => {
      if (!(target instanceof Element)) {
        return
      }
      if (target.closest(FLOATING_PANEL)) {
        setPanelInFront(true)
      } else if (target.closest(MIRROR_SURFACE)) {
        setPanelInFront(false)
      }
    }
    const onUse = (event: Event): void => noteUse(event.target)
    // Why blur: a click inside a loaded page in an embedded browser reaches this document only as
    // the window losing focus to that browser element.
    const onBlur = (): void => noteUse(document.activeElement)
    window.addEventListener('pointerdown', onUse, true)
    window.addEventListener('focusin', onUse, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onUse, true)
      window.removeEventListener('focusin', onUse, true)
      window.removeEventListener('blur', onBlur)
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
