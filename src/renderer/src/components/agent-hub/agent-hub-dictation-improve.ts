import {
  DICTATION_CONTROL_EVENT,
  dispatchDictationControl
} from '../dictation/dictation-control-events'
import { readAgentHubDictationCapabilities } from './agent-hub-dictation-capabilities'

/** Keep legacy dictation's bare action form unless the controller understands improvement. */
export function startAgentHubDictation(improve: boolean): void {
  if (improve && readAgentHubDictationCapabilities().improve) {
    document.dispatchEvent(
      new CustomEvent(DICTATION_CONTROL_EVENT, { detail: { action: 'start', improve: true } })
    )
  } else {
    dispatchDictationControl('start')
  }
}
