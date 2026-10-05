import { useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { getShortcutPlatform } from '@/lib/shortcut-platform'
import {
  findKeybindingConflicts,
  formatKeybindingList,
  getEffectiveKeybindingsForDefinition,
  getKeybindingDefinition,
  type KeybindingActionId
} from '../../../../shared/keybindings'
import { Button } from '../ui/button'
import { SettingsRow } from '../settings/SettingsFormControls'
import { AGENT_HUB_SUGGESTED_BINDINGS as SUGGESTED_BINDINGS } from './agent-hub-shortcut-suggestions'

const platform = getShortcutPlatform()

function bindingsFor(
  actionId: KeybindingActionId,
  overrides: Parameters<typeof getEffectiveKeybindingsForDefinition>[2]
): string[] {
  const definition = getKeybindingDefinition(actionId)
  return definition ? getEffectiveKeybindingsForDefinition(definition, platform, overrides) : []
}

/** Shows the hub's shortcuts and binds the suggested chords for any still unset. */
export function AgentHubShortcutSetting(): React.JSX.Element {
  const keybindings = useAppStore((s) => s.keybindings)
  const setKeybindingOverride = useAppStore((s) => s.setKeybindingOverride)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const [error, setError] = useState<string | null>(null)
  const current = SUGGESTED_BINDINGS.map(([actionId]) => bindingsFor(actionId, keybindings))
  // Why per action: someone who bound the first two before the third existed still gets offered it.
  const missing = SUGGESTED_BINDINGS.filter((_, index) => (current[index] ?? []).length === 0)
  const unbound = missing.length > 0
  const shown = (index: number): string =>
    formatKeybindingList(current[index] ?? [], platform) ||
    translate('auto.components.settings.ExperimentalPane.agentHub.shortcutNotSet', 'not set')
  const suggestedLabel = formatKeybindingList(
    missing.map(([, binding]) => binding),
    platform
  )

  const applySuggested = async (): Promise<void> => {
    const next = { ...keybindings }
    for (const [actionId, binding] of missing) {
      next[actionId] = [binding]
    }
    const conflict = findKeybindingConflicts(platform, next).find((candidate) =>
      missing.some(([actionId]) => candidate.actionIds.includes(actionId))
    )
    if (conflict) {
      const owners = conflict.actionIds
        .filter((actionId) => !missing.some(([own]) => own === actionId))
        .map((actionId) => getKeybindingDefinition(actionId)?.title ?? actionId)
        .join(', ')
      setError(
        translate(
          'auto.components.settings.ExperimentalPane.agentHub.shortcutTaken',
          '{{value0}} is already used by {{value1}}. Pick other keys in Keyboard Shortcuts.',
          { value0: formatKeybindingList([conflict.binding], platform), value1: owners }
        )
      )
      return
    }
    setError(null)
    try {
      for (const [actionId, binding] of missing) {
        await setKeybindingOverride(actionId, [binding])
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }

  return (
    <SettingsRow
      label={translate('auto.components.settings.ExperimentalPane.agentHub.shortcuts', 'Shortcuts')}
      description={
        error ??
        (missing.length === SUGGESTED_BINDINGS.length
          ? translate(
              'auto.components.settings.ExperimentalPane.agentHub.shortcutsUnset',
              'Not set. Suggested: {{value0}} (open the hub, jump to the next agent waiting, send the mirrors to the hub, arrange the mirrors).',
              { value0: suggestedLabel }
            )
          : translate(
              'auto.components.settings.ExperimentalPane.agentHub.shortcutsSet',
              'Open the hub: {{value0}} · Next agent waiting: {{value1}} · Mirrors to the hub: {{value2}} · Arrange the mirrors: {{value3}}',
              {
                value0: shown(0),
                value1: shown(1),
                value2: shown(2),
                value3: shown(3)
              }
            ))
      }
      control={
        unbound ? (
          <Button type="button" variant="outline" size="xs" onClick={() => void applySuggested()}>
            {translate(
              'auto.components.settings.ExperimentalPane.agentHub.useSuggested',
              'Use these'
            )}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => openSettingsTarget({ pane: 'shortcuts', repoId: null })}
          >
            {translate('auto.components.settings.ExperimentalPane.agentHub.editShortcuts', 'Edit')}
          </Button>
        )
      }
    />
  )
}
