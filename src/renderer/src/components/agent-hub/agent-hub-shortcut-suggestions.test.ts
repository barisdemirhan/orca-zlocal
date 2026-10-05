import { describe, expect, it } from 'vitest'
import {
  findKeybindingConflicts,
  getEffectiveKeybindingsForDefinition,
  getKeybindingDefinition,
  type KeybindingOverrides
} from '../../../../shared/keybindings'
import { AGENT_HUB_SUGGESTED_BINDINGS } from './agent-hub-shortcut-suggestions'

const PLATFORMS: readonly NodeJS.Platform[] = ['darwin', 'linux', 'win32']

describe('agent hub shortcut suggestions', () => {
  it('offers a chord for arranging the mirrors', () => {
    expect(AGENT_HUB_SUGGESTED_BINDINGS.map(([actionId]) => actionId)).toContain(
      'agentHub.arrangeMirrors'
    )
  })

  it.each(PLATFORMS)('leaves every hub action unbound by default on %s', (platform) => {
    for (const [actionId] of AGENT_HUB_SUGGESTED_BINDINGS) {
      const definition = getKeybindingDefinition(actionId)
      expect(definition, actionId).toBeDefined()
      expect(
        definition ? getEffectiveKeybindingsForDefinition(definition, platform, {}) : null,
        actionId
      ).toEqual([])
    }
  })

  it.each(PLATFORMS)('suggests chords no default binding uses on %s', (platform) => {
    const overrides: KeybindingOverrides = Object.fromEntries(
      AGENT_HUB_SUGGESTED_BINDINGS.map(([actionId, binding]) => [actionId, [binding]])
    )
    const own = new Set(AGENT_HUB_SUGGESTED_BINDINGS.map(([actionId]) => actionId))

    const conflicts = findKeybindingConflicts(platform, overrides).filter((conflict) =>
      conflict.actionIds.some((actionId) => own.has(actionId))
    )

    expect(conflicts).toEqual([])
  })
})
