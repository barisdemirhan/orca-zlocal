import { useRef } from 'react'

// Releasing the right button over the menu it just opened must not pick an item.
const OPENING_CLICK_MS = 350

/** For a context menu: tells the release of the opening right-click from a real pick. */
export function useMenuOpeningClickGuard(): {
  noteOpenChange: (open: boolean) => void
  isOpeningClick: () => boolean
} {
  const openedAtRef = useRef(0)
  return {
    noteOpenChange: (open) => {
      if (open) {
        openedAtRef.current = performance.now()
      }
    },
    isOpeningClick: () => performance.now() - openedAtRef.current < OPENING_CLICK_MS
  }
}
