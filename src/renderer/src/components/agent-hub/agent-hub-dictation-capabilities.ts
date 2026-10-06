const DICTATION_CAPABILITIES_EVENT = 'dictation:capabilities'

/** The mounted controller answers synchronously; older builds leave improve false. */
export function readAgentHubDictationCapabilities(): { cancel: boolean; improve: boolean } {
  const detail = { cancel: false, improve: false }
  document.dispatchEvent(new CustomEvent(DICTATION_CAPABILITIES_EVENT, { detail }))
  return { cancel: detail.cancel === true, improve: detail.improve === true }
}
