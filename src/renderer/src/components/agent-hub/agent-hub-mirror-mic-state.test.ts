import { describe, expect, it } from 'vitest'
import type { SpeechModelManifest, SpeechModelState } from '../../../../shared/speech/speech-types'
import {
  agentHubMirrorDictationPane,
  agentHubMirrorMicState,
  agentHubVoiceModelChoices,
  isSpeechModelReady,
  mirrorOwnsDictation
} from './agent-hub-mirror-mic-state'

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'

const ready = {
  dictationState: 'idle',
  ownsDictation: false,
  voiceEnabled: true,
  modelReady: true,
  reachable: true
} as const

function manifest(id: string, recommended = false): SpeechModelManifest {
  return {
    id,
    label: `Model ${id}`,
    type: 'whisper',
    provider: 'local',
    language: 'en',
    languages: ['en'],
    sampleRate: 16000,
    streaming: false,
    recommended
  }
}

function states(...ids: string[]): SpeechModelState[] {
  return ids.map((id) => ({ id, status: 'ready' }))
}

describe('agentHubMirrorMicState', () => {
  it('is idle when voice is on, a model is ready and nothing is dictating', () => {
    expect(agentHubMirrorMicState(ready)).toBe('idle')
  })

  it('follows the phases of a dictation that started in this mirror', () => {
    const mine = { ...ready, ownsDictation: true }
    expect(agentHubMirrorMicState({ ...mine, dictationState: 'starting' })).toBe('starting')
    expect(agentHubMirrorMicState({ ...mine, dictationState: 'listening' })).toBe('listening')
    expect(agentHubMirrorMicState({ ...mine, dictationState: 'stopping' })).toBe('finishing')
  })

  it('reports a dictation that started anywhere else, whatever its phase', () => {
    for (const dictationState of ['starting', 'listening', 'stopping'] as const) {
      expect(agentHubMirrorMicState({ ...ready, dictationState })).toBe('elsewhere')
    }
  })

  it('treats a failed start as over', () => {
    expect(agentHubMirrorMicState({ ...ready, dictationState: 'error' })).toBe('idle')
  })

  it('says why it cannot start: voice off, then no usable model', () => {
    expect(agentHubMirrorMicState({ ...ready, voiceEnabled: false })).toBe('disabled')
    expect(
      agentHubMirrorMicState({
        ...ready,
        voiceEnabled: false,
        modelReady: false
      })
    ).toBe('disabled')
    expect(agentHubMirrorMicState({ ...ready, modelReady: false })).toBe('no-model')
  })

  it('is unsupported for a terminal dictation cannot type into', () => {
    expect(agentHubMirrorMicState({ ...ready, reachable: false })).toBe('unsupported')
  })

  it('leaves dictation to an open quick-reply card, but still owns a run it started', () => {
    expect(agentHubMirrorMicState({ ...ready, answeringInCard: true })).toBe('answering')
    expect(
      agentHubMirrorMicState({
        ...ready,
        answeringInCard: true,
        ownsDictation: true,
        dictationState: 'listening'
      })
    ).toBe('listening')
  })

  it('keeps showing a running dictation after voice is switched off mid-run', () => {
    expect(
      agentHubMirrorMicState({
        ...ready,
        voiceEnabled: false,
        ownsDictation: true,
        dictationState: 'listening'
      })
    ).toBe('listening')
  })
})

describe('isSpeechModelReady', () => {
  it('needs a selected model', () => {
    expect(isSpeechModelReady('', states('a'))).toBe(false)
    expect(isSpeechModelReady(undefined, states('a'))).toBe(false)
  })

  it('needs the selected model downloaded once its state is known', () => {
    expect(isSpeechModelReady('a', states('a'))).toBe(true)
    expect(isSpeechModelReady('a', [{ id: 'a', status: 'not-downloaded' }])).toBe(false)
    expect(isSpeechModelReady('a', [{ id: 'a', status: 'downloading', progress: 0.4 }])).toBe(false)
  })

  it('does not block on model states that have not loaded yet', () => {
    expect(isSpeechModelReady('a', [])).toBe(true)
  })
})

describe('mirrorOwnsDictation', () => {
  const agentMirror = agentHubMirrorDictationPane({
    tab: { id: 'tab-1' },
    paneKey: `tab-1:${LEAF_A}`
  })
  const shellMirror = agentHubMirrorDictationPane({
    tab: { id: 'tab-1' },
    paneKey: null
  })

  it('matches the pane the dictation started in', () => {
    expect(mirrorOwnsDictation({ pane: { tabId: 'tab-1', leafId: LEAF_A } }, agentMirror)).toBe(
      true
    )
  })

  it('does not match a sibling pane of the same tab, or another tab', () => {
    expect(mirrorOwnsDictation({ pane: { tabId: 'tab-1', leafId: LEAF_B } }, agentMirror)).toBe(
      false
    )
    expect(mirrorOwnsDictation({ pane: { tabId: 'tab-2', leafId: LEAF_A } }, agentMirror)).toBe(
      false
    )
  })

  it('lets a shell mirror own any pane of its tab', () => {
    expect(mirrorOwnsDictation({ pane: { tabId: 'tab-1', leafId: LEAF_B } }, shellMirror)).toBe(
      true
    )
  })

  it('owns nothing while idle or when the dictation did not start in a terminal', () => {
    expect(mirrorOwnsDictation(null, agentMirror)).toBe(false)
    expect(mirrorOwnsDictation({ pane: null }, agentMirror)).toBe(false)
  })
})

describe('agentHubVoiceModelChoices', () => {
  it('lists only downloaded models, by their catalog label', () => {
    const catalog = [manifest('a'), manifest('b'), manifest('c')]
    const modelStates: SpeechModelState[] = [
      { id: 'a', status: 'ready' },
      { id: 'b', status: 'not-downloaded' },
      { id: 'c', status: 'downloading', progress: 0.5 }
    ]
    expect(agentHubVoiceModelChoices(catalog, modelStates, 'a')).toEqual({
      choices: [{ id: 'a', label: 'Model a' }],
      more: false
    })
  })

  it('puts the active model first, then recommended ones, then the catalog order', () => {
    const catalog = [manifest('a'), manifest('b'), manifest('c', true), manifest('d')]
    const { choices } = agentHubVoiceModelChoices(catalog, states('a', 'b', 'c', 'd'), 'd')
    expect(choices.map((choice) => choice.id)).toEqual(['d', 'c', 'a', 'b'])
  })

  it('shows at most four and says when more are downloaded', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const result = agentHubVoiceModelChoices(
      ids.map((id) => manifest(id)),
      states(...ids),
      'f'
    )
    expect(result.choices.map((choice) => choice.id)).toEqual(['f', 'a', 'b', 'c'])
    expect(result.more).toBe(true)
    expect(
      agentHubVoiceModelChoices(
        ids.slice(0, 4).map((id) => manifest(id)),
        states(...ids.slice(0, 4)),
        'a'
      ).more
    ).toBe(false)
  })

  it("lists a downloaded model the catalog does not know (the user's own) by its id", () => {
    expect(agentHubVoiceModelChoices([manifest('a')], states('a', 'mine'), 'mine').choices).toEqual(
      [
        { id: 'mine', label: 'mine' },
        { id: 'a', label: 'Model a' }
      ]
    )
  })

  it('offers nothing when no model is downloaded', () => {
    expect(agentHubVoiceModelChoices([manifest('a')], [], 'a')).toEqual({
      choices: [],
      more: false
    })
  })
})
