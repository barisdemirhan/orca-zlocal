import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type {
  DictationState,
  SpeechModelManifest,
  SpeechModelState
} from '../../../../shared/speech/speech-types'

/** The terminal pane a dictation started in. */
export type AgentHubDictationPane = { tabId: string; leafId: string | null }

/** The running dictation; `pane` is null when it did not start in a terminal. */
export type AgentHubDictationSession = { pane: AgentHubDictationPane | null }

export type AgentHubMirrorMicState =
  /** Ready: a click dictates into this mirror's terminal. */
  | 'idle'
  /** This mirror's dictation, by phase. */
  | 'starting'
  | 'listening'
  | 'finishing'
  /** A dictation runs somewhere else; only one runs at a time. */
  | 'elsewhere'
  /** Voice dictation is off in settings. */
  | 'disabled'
  /** No speech model is selected, or the selected one is not downloaded. */
  | 'no-model'
  /** This mirror shows a terminal that dictation cannot type into. */
  | 'unsupported'
  /** The pane's quick-reply card is open; its own mic dictates the answer. */
  | 'answering'

export function isDictationRunning(state: DictationState): boolean {
  // Why not a list of running states: a state added later (transcript clean-up) is still a run.
  return state !== 'idle' && state !== 'error'
}

export function agentHubMirrorDictationPane(target: {
  tab: { id: string }
  paneKey: string | null
}): AgentHubDictationPane {
  const leafId = target.paneKey ? (parsePaneKey(target.paneKey)?.leafId ?? null) : null
  return { tabId: target.tab.id, leafId }
}

/** Whether the running dictation started in the pane this mirror shows. */
export function mirrorOwnsDictation(
  session: AgentHubDictationSession | null,
  pane: AgentHubDictationPane
): boolean {
  const origin = session?.pane
  if (!origin || origin.tabId !== pane.tabId) {
    return false
  }
  // A shell mirror (no leaf) follows whichever pane of its tab is active.
  return pane.leafId === null || origin.leafId === null || origin.leafId === pane.leafId
}

export function isSpeechModelReady(
  sttModel: string | undefined,
  modelStates: readonly SpeechModelState[]
): boolean {
  if (!sttModel) {
    return false
  }
  const state = modelStates.find((candidate) => candidate.id === sttModel)
  // Model states load on demand: a model not listed yet is left for dictation itself to judge.
  return !state || state.status === 'ready'
}

export function agentHubMirrorMicState({
  dictationState,
  ownsDictation,
  voiceEnabled,
  modelReady,
  reachable,
  answeringInCard = false
}: {
  dictationState: DictationState
  ownsDictation: boolean
  voiceEnabled: boolean
  modelReady: boolean
  /** False when the mirror shows a terminal dictation cannot type into. */
  reachable: boolean
  /** The pane's quick-reply card is open. */
  answeringInCard?: boolean
}): AgentHubMirrorMicState {
  if (isDictationRunning(dictationState)) {
    if (!ownsDictation) {
      return 'elsewhere'
    }
    if (dictationState === 'starting' || dictationState === 'listening') {
      return dictationState
    }
    return 'finishing'
  }
  if (answeringInCard) {
    return 'answering'
  }
  if (!reachable) {
    return 'unsupported'
  }
  if (!voiceEnabled) {
    return 'disabled'
  }
  return modelReady ? 'idle' : 'no-model'
}

export type AgentHubVoiceModelChoice = { id: string; label: string }

export const AGENT_HUB_VOICE_MODEL_CAP = 4

/**
 * The downloaded speech models a menu offers: the active one first, then recommended ones, then
 * the catalog's order. `more` says the cap left some out.
 */
export function agentHubVoiceModelChoices(
  catalog: readonly SpeechModelManifest[],
  modelStates: readonly SpeechModelState[],
  activeId: string | undefined,
  cap = AGENT_HUB_VOICE_MODEL_CAP
): { choices: AgentHubVoiceModelChoice[]; more: boolean } {
  const ready = new Set(
    modelStates.filter((state) => state.status === 'ready').map((state) => state.id)
  )
  const listed = catalog.filter((manifest) => ready.has(manifest.id))
  const listedIds = new Set(listed.map((manifest) => manifest.id))
  const rank = (id: string, recommended: boolean): number =>
    id === activeId ? 0 : recommended ? 1 : 2
  const ordered = [
    ...listed.map((manifest) => ({
      id: manifest.id,
      label: manifest.label,
      rank: rank(manifest.id, manifest.recommended === true)
    })),
    // A ready model outside the catalog (the user's own) has only its id to show.
    ...[...ready]
      .filter((id) => !listedIds.has(id))
      .map((id) => ({ id, label: id, rank: rank(id, false) }))
  ].toSorted((a, b) => a.rank - b.rank)
  return {
    choices: ordered.slice(0, cap).map(({ id, label }) => ({ id, label })),
    more: ordered.length > cap
  }
}
