import { useEffect, type RefObject } from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { DictationState } from '../../../../shared/speech-types'
import type { DictationInsertionTarget } from './dictation-insertion-target'
import { DICTATION_CONTROL_EVENT } from './dictation-control-events'

export function useDictationControlEvents({
  settings,
  state,
  target,
  cancelled,
  discard,
  start,
  stop
}: {
  settings: GlobalSettings | null
  state: RefObject<DictationState>
  target: RefObject<DictationInsertionTarget | null>
  cancelled: RefObject<boolean>
  discard: () => void
  start: () => Promise<void>
  stop: () => Promise<void>
}): void {
  useEffect(() => {
    const control = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const action = event.detail
      if (action === 'cancel') {
        target.current = null
        cancelled.current = true
        discard()
        if (state.current !== 'idle' && state.current !== 'error') {
          void stop()
        }
        return
      }
      if (!settings?.voice?.enabled || state.current === 'stopping') {
        return
      }
      if (action === 'start') {
        if (state.current === 'idle') {
          void start()
        }
      } else if (action === 'stop' || action === 'toggle') {
        if (state.current === 'listening' || state.current === 'starting') {
          void stop()
        } else if (action === 'toggle') {
          void start()
        }
      }
    }
    const capabilities = (event: Event) => {
      if (event instanceof CustomEvent) {
        event.detail.cancel = true
      }
    }
    document.addEventListener(DICTATION_CONTROL_EVENT, control)
    document.addEventListener('dictation:capabilities', capabilities)
    return () => {
      document.removeEventListener(DICTATION_CONTROL_EVENT, control)
      document.removeEventListener('dictation:capabilities', capabilities)
    }
  }, [
    settings?.voice?.enabled,
    state,
    target,
    cancelled,
    discard,
    start,
    stop
  ])
}
