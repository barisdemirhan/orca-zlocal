import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import { readAgentHubDictationCapabilities } from './agent-hub-dictation-capabilities'

// Why by name: canceling a dictation and the probe that says whether the mounted controller
// can do it belong to the dictation feature and may not be in this build. Named here, the
// mirror's indicator offers Cancel only where it works, without importing either.
const CANCEL_ACTION = 'cancel'

/** Whether the mounted dictation controller handles a cancel (it answers synchronously). */
export function canCancelDictation(): boolean {
  return readAgentHubDictationCapabilities().cancel
}

/** Throws the running dictation away: nothing more is inserted. */
export function cancelDictation(): void {
  document.dispatchEvent(new CustomEvent(DICTATION_CONTROL_EVENT, { detail: CANCEL_ACTION }))
}
