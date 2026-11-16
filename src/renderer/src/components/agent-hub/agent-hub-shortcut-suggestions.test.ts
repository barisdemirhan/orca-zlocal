import { describe, expect, it } from 'vitest'
import { findKeybindingConflicts, findKeybindingConflictsForDefinitions } from '../../../../shared/keybindings/formatting'
import { KEYBINDING_DEFINITIONS, getKeybindingDefinition } from '../../../../shared/keybindings/definitions'
import { normalizeKeybindingListForAction } from '../../../../shared/keybindings/normalization'
import { getEffectiveKeybindingsForDefinition } from '../../../../shared/keybindings/effective'
import type { KeybindingOverrides } from '../../../../shared/keybindings/types'
import { agentHubSuggestedBindings } from './agent-hub-shortcut-suggestions'

const PLATFORMS: readonly NodeJS.Platform[] = ['darwin', 'linux', 'win32']

describe('agent hub shortcut suggestions', () => {
  it.each(PLATFORMS)('avoids common terminal, editor and native menu chords on %s', (platform) => {
    const common =
      platform === 'darwin'
        ? [
            'Ctrl+C',
            'Ctrl+D',
            'Ctrl+R',
            'Ctrl+U',
            'Ctrl+W',
            'Ctrl+Z',
            'Mod+Shift+P',
            'Mod+Shift+K',
            'Mod+Shift+L',
            'Mod+Alt+H',
            'Mod+Alt+M',
            'Mod+Alt+D',
            'Mod+Alt+I'
          ]
        : [
            'Ctrl+C',
            'Ctrl+D',
            'Ctrl+R',
            'Ctrl+U',
            'Ctrl+W',
            'Ctrl+Z',
            'Ctrl+Shift+C',
            'Ctrl+Shift+V',
            'Ctrl+Shift+P',
            'Ctrl+Shift+K',
            'Ctrl+Shift+L',
            'Alt+Shift+F',
            'Alt+Shift+I',
            'Alt+Shift+O',
            'Alt+Shift+A'
          ]
    for (const [, binding] of agentHubSuggestedBindings(platform)) {
      expect(common, binding).not.toContain(binding)
    }
  })
  it.each(PLATFORMS)(
    'offers hub actions including mirror tabs while keeping Orb unassigned on %s',
    (platform) => {
      expect(agentHubSuggestedBindings(platform).map(([id]) => id)).toEqual(
        KEYBINDING_DEFINITIONS.filter(
          (item) =>
            item.id.startsWith('agentHub.') &&
            !item.id.startsWith('agentHub.orb.') &&
            item.id !== 'agentHub.toggleOrb' &&
            item.id !== 'agentHub.openAnswerQueue'
        ).map((item) => item.id)
      )
      for (const [id, binding] of agentHubSuggestedBindings(platform)) {
        if (!id.endsWith('MirrorTab')) {
          expect(binding.split('+')).toHaveLength(3)
          expect(binding).toMatch(
            platform === 'darwin' ? /^Mod\+Alt\+[A-Z]$/ : /^Alt\+Shift\+[A-Z]$/
          )
        }
        expect(normalizeKeybindingListForAction(id, binding)).toEqual([binding])
      }
    }
  )

  it.each(PLATFORMS)('leaves every hub action unbound by default on %s', (platform) => {
    for (const [actionId] of agentHubSuggestedBindings(platform)) {
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
      agentHubSuggestedBindings(platform).map(([actionId, binding]) => [actionId, [binding]])
    )
    const own = new Set(agentHubSuggestedBindings(platform).map(([actionId]) => actionId))

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
