import { afterEach, expect, it, vi } from 'vitest'
import { getEffectiveKeybindingsForDefinition } from '../../../../shared/keybindings/effective'
import { getKeybindingDefinition } from '../../../../shared/keybindings/definitions'
import { registerAgentHubAnswerQueueCommand, registerAgentHubCommands } from './agent-hub-commands'
import { agentHubCommandHandlers } from './agent-hub-command-handlers'
import {
  openAgentHubAnswerQueue,
  updateAgentHubAnswerQueuePresence,
  useAgentHubAnswerQueueState
} from './agent-hub-answer-queue-store'

vi.mock('./agent-hub-mirror-tab-command', () => ({
  agentHubMirrorTabCommandAvailable: () => false
}))

afterEach(() => useAgentHubAnswerQueueState.setState({ open: false, count: 0, enabled: false }))

it('keeps the queue action unbound on every platform and dispatches it through Hub commands', () => {
  const definition = getKeybindingDefinition('agentHub.openAnswerQueue')
  if (!definition) {
    throw new Error('expected answer queue shortcut')
  }
  for (const platform of ['darwin', 'linux', 'win32'] as const) {
    expect(getEffectiveKeybindingsForDefinition(definition, platform, {})).toEqual([])
  }
  const removeHub = registerAgentHubCommands({
    toggle: vi.fn(),
    jumpToNextWaiting: vi.fn(),
    toggleMirrors: vi.fn(),
    focusMirror: null,
    popOut: null,
    jumpToMirror: null,
    toggleCanvas: null,
    arrangeMirrors: null
  })
  const removeQueue = registerAgentHubAnswerQueueCommand(openAgentHubAnswerQueue)
  try {
    updateAgentHubAnswerQueuePresence(true, 0)
    const action = agentHubCommandHandlers((_id, run) => {
      run()
      return true
    }).find(([id]) => id === 'agentHub.openAnswerQueue')?.[1]
    expect(action?.()).toBe(true)
    expect(useAgentHubAnswerQueueState.getState().open).toBe(true)
    updateAgentHubAnswerQueuePresence(false, 0)
    action?.()
    expect(useAgentHubAnswerQueueState.getState().open).toBe(false)
  } finally {
    removeQueue()
    removeHub()
  }
})
