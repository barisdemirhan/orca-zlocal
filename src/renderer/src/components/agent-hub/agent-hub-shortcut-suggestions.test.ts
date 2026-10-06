import { describe, expect, it } from 'vitest'
import {
  findKeybindingConflicts,
  findKeybindingConflictsForDefinitions,
  KEYBINDING_DEFINITIONS,
  normalizeKeybindingListForAction,
  getEffectiveKeybindingsForDefinition,
  getKeybindingDefinition,
  type KeybindingOverrides
} from '../../../../shared/keybindings'
import { AGENT_HUB_SUGGESTED_BINDINGS } from './agent-hub-shortcut-suggestions'

const PLATFORMS: readonly NodeJS.Platform[] = ['darwin', 'linux', 'win32']

describe('agent hub shortcut suggestions', () => {
  it('offers every hub action with one modifier and one key', () => {
    expect(AGENT_HUB_SUGGESTED_BINDINGS.map(([id]) => id)).toEqual(
      KEYBINDING_DEFINITIONS.filter((item) => item.id.startsWith('agentHub.')).map(
        (item) => item.id
      )
    )
    for (const [id, binding] of AGENT_HUB_SUGGESTED_BINDINGS) {
      expect(binding.split('+')).toHaveLength(2)
      expect(binding).toMatch(/^Mod\+/)
      expect(normalizeKeybindingListForAction(id, binding)).toEqual([binding])
    }
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
    // Suggestions must also avoid defaults in other scopes (editors, tabs and terminals).
    expect(
      findKeybindingConflictsForDefinitions(
        KEYBINDING_DEFINITIONS.map((definition) => ({
          ...definition,
          scope: 'global' as const,
          conflictGroup: undefined
        })),
        platform,
        overrides
      ).filter((conflict) => conflict.actionIds.some((id) => own.has(id)))
    ).toEqual([])
  })
})
