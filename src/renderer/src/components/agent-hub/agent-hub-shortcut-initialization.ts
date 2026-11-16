import { findKeybindingConflictsForDefinitions } from '../../../../shared/keybindings/formatting'
import { getEffectiveKeybindingsForDefinition } from '../../../../shared/keybindings/effective'
import type { KeybindingDefinition, KeybindingOverrides, KeybindingActionId } from '../../../../shared/keybindings/types'
import type { AgentHubSettings } from '../../../../shared/agent-hub-settings'
import { agentHubSuggestedBindings } from './agent-hub-shortcut-suggestions'

type InitializationState = {
  settings: Pick<AgentHubSettings, 'experimentalAgentHub' | 'agentHubShortcutsInitialized'> | null
  keybindings: KeybindingOverrides
  updateSettingsOrThrow: (updates: { agentHubShortcutsInitialized: boolean }) => Promise<void>
  setKeybindingOverride: (action: KeybindingActionId, bindings: string[]) => Promise<void>
}

export function availableAgentHubSuggestions(
  definitions: readonly KeybindingDefinition[],
  platform: NodeJS.Platform,
  bindings: KeybindingOverrides
): readonly (readonly [KeybindingActionId, string])[] {
  const flattened = definitions.map((definition) => ({
    ...definition,
    scope: 'global' as const,
    conflictGroup: undefined
  }))
  const next = { ...bindings }
  return agentHubSuggestedBindings(platform).filter(([actionId, binding]) => {
    const definition = definitions.find((item) => item.id === actionId)
    if (
      !definition ||
      getEffectiveKeybindingsForDefinition(definition, platform, next).length > 0
    ) {
      return false
    }
    const candidate = { ...next, [actionId]: [binding] }
    if (
      findKeybindingConflictsForDefinitions(flattened, platform, candidate).some((conflict) =>
        conflict.actionIds.includes(actionId)
      )
    ) {
      return false
    }
    next[actionId] = [binding]
    return true
  })
}

let applying: Promise<void> | null = null

export function initializeAgentHubShortcutsOnce(
  getState: () => InitializationState,
  definitions: readonly KeybindingDefinition[],
  platform: NodeJS.Platform
): Promise<void> {
  if (applying) {
    return applying
  }
  const state = getState()
  if (
    state.settings?.experimentalAgentHub !== true ||
    state.settings.agentHubShortcutsInitialized === true
  ) {
    return Promise.resolve()
  }
  applying = (async () => {
    // Persist the one-time decision first so removal or an interrupted run never rebinds a key.
    await state.updateSettingsOrThrow({ agentHubShortcutsInitialized: true })
    for (const [actionId] of agentHubSuggestedBindings(platform)) {
      const current = getState()
      if (current.settings?.experimentalAgentHub !== true) {
        return
      }
      const suggestion = availableAgentHubSuggestions(
        definitions,
        platform,
        current.keybindings
      ).find(([id]) => id === actionId)
      if (suggestion) {
        await current.setKeybindingOverride(actionId, [suggestion[1]])
      }
    }
  })().finally(() => {
    applying = null
  })
  return applying
}
