import { expect, it, vi } from 'vitest'
import { pluginCommandKeybindingActionId } from '../../../../shared/plugins/contributions/plugin-command-actions'
import { KEYBINDING_DEFINITIONS } from '../../../../shared/keybindings/definitions'
import { agentHubSuggestedBindings } from './agent-hub-shortcut-suggestions'
import {
  availableAgentHubSuggestions,
  initializeAgentHubShortcutsOnce
} from './agent-hub-shortcut-initialization'

type State = ReturnType<Parameters<typeof initializeAgentHubShortcutsOnce>[0]>
function fixture(enabled = true): State {
  const state: State = {
    settings: { experimentalAgentHub: enabled },
    keybindings: {},
    updateSettingsOrThrow: vi.fn(async (updates) => {
      state.settings = { ...state.settings, ...updates }
    }),
    setKeybindingOverride: vi.fn(async (id, bindings) => {
      state.keybindings = { ...state.keybindings, [id]: bindings }
    })
  }
  return state
}

it.each(['darwin', 'linux', 'win32'] as const)(
  'fills only missing actions and skips user collisions across scopes on %s',
  async (platform) => {
    const state = fixture()
    const suggested = agentHubSuggestedBindings(platform)
    state.keybindings = {
      'agentHub.toggle': ['DoubleTap+Alt'],
      'terminal.search': [suggested[6][1]]
    }
    await initializeAgentHubShortcutsOnce(() => state, KEYBINDING_DEFINITIONS, platform)
    expect(state.keybindings['agentHub.toggle']).toEqual(['DoubleTap+Alt'])
    expect(state.keybindings['agentHub.popOut']).toBeUndefined()
    expect(state.settings?.agentHubShortcutsInitialized).toBe(true)
    for (const [id, binding] of suggested.slice(1, 6)) {
      expect(state.keybindings[id]).toEqual([binding])
    }
  }
)

it('runs on first enable or an already-enabled launch, then never re-applies removed bindings', async () => {
  const state = fixture(false)
  await initializeAgentHubShortcutsOnce(() => state, KEYBINDING_DEFINITIONS, 'darwin')
  expect(state.updateSettingsOrThrow).not.toHaveBeenCalled()
  state.settings = { experimentalAgentHub: true }
  await Promise.all([
    initializeAgentHubShortcutsOnce(() => state, KEYBINDING_DEFINITIONS, 'darwin'),
    initializeAgentHubShortcutsOnce(() => state, KEYBINDING_DEFINITIONS, 'darwin')
  ])
  expect(state.updateSettingsOrThrow).toHaveBeenCalledTimes(1)
  expect(state.keybindings['agentHub.nextMirrorTab']).toHaveLength(1)
  expect(state.keybindings['agentHub.previousMirrorTab']).toHaveLength(1)
  expect(state.keybindings['agentHub.toggleOrb']).toBeUndefined()
  vi.mocked(state.setKeybindingOverride).mockClear()
  state.keybindings['agentHub.popOut'] = []
  await initializeAgentHubShortcutsOnce(() => state, KEYBINDING_DEFINITIONS, 'darwin')
  expect(state.keybindings['agentHub.popOut']).toEqual([])
  expect(state.setKeybindingOverride).not.toHaveBeenCalled()
  const launch = fixture()
  await initializeAgentHubShortcutsOnce(() => launch, KEYBINDING_DEFINITIONS, 'darwin')
  expect(launch.keybindings['agentHub.nextMirrorTab']).toHaveLength(1)
  expect(launch.keybindings['agentHub.previousMirrorTab']).toHaveLength(1)
  expect(launch.keybindings['agentHub.toggleOrb']).toBeUndefined()
})

it('rechecks current bindings after each persisted write', async () => {
  const state = fixture()
  vi.mocked(state.setKeybindingOverride).mockImplementation(async (id, bindings) => {
    state.keybindings = {
      ...state.keybindings,
      [id]: bindings,
      'agentHub.nextWaiting': ['DoubleTap+Alt']
    }
  })
  await initializeAgentHubShortcutsOnce(() => state, KEYBINDING_DEFINITIONS, 'darwin')
  expect(state.keybindings['agentHub.nextWaiting']).toEqual(['DoubleTap+Alt'])
  expect(state.setKeybindingOverride).not.toHaveBeenCalledWith(
    'agentHub.nextWaiting',
    expect.anything()
  )
})

it('does not apply anything if the one-time flag cannot be persisted', async () => {
  const state = fixture()
  vi.mocked(state.updateSettingsOrThrow).mockRejectedValueOnce(new Error('disk full'))
  await expect(
    initializeAgentHubShortcutsOnce(() => state, KEYBINDING_DEFINITIONS, 'darwin')
  ).rejects.toThrow('disk full')
  expect(state.setKeybindingOverride).not.toHaveBeenCalled()
})

it('skips conflicts in plugin definitions as well as the static registry', () => {
  const [actionId, binding] = agentHubSuggestedBindings('darwin')[0]
  const plugin = {
    ...KEYBINDING_DEFINITIONS[0],
    id: pluginCommandKeybindingActionId('example', 'test'),
    defaultBindings: { darwin: [binding], linux: [], win32: [] }
  }
  const plan = availableAgentHubSuggestions([...KEYBINDING_DEFINITIONS, plugin], 'darwin', {})
  expect(plan.some(([id]) => id === actionId)).toBe(false)
})
