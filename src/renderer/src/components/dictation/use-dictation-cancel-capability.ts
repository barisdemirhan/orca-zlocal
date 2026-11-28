import { useEffect } from 'react'

/** Agent Hub asks whether this controller handles its cancel action before offering one. */
export function useDictationCancelCapability(): void {
  useEffect(() => {
    const answer = (event: Event): void => {
      if (event instanceof CustomEvent) {
        event.detail.cancel = true
      }
    }
    document.addEventListener('dictation:capabilities', answer)
    return () => document.removeEventListener('dictation:capabilities', answer)
  }, [])
}
