import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'

// Why by name: canceling a dictation and the probe that says whether the mounted controller
// can do it belong to the dictation feature and may not be in this build. Named here, the
// mirror's indicator offers Cancel only where it works, without importing either.
const DICTATION_CAPABILITIES_EVENT = 'dictation:capabilities'
const CANCEL_ACTION = 'cancel'

/** Whether the mounted dictation controller handles a cancel (it answers synchronously). */
export function canCancelDictation(): boolean {
  const detail = { cancel: false }
  document.dispatchEvent(new CustomEvent(DICTATION_CAPABILITIES_EVENT, { detail }))
  return detail.cancel
}

/** Throws the running dictation away: nothing more is inserted. */
export function cancelDictation(): void {
  document.dispatchEvent(new CustomEvent(DICTATION_CONTROL_EVENT, { detail: CANCEL_ACTION }))
}
