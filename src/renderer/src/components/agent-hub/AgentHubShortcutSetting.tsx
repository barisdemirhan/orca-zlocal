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

// Why suggested, not default: an experimental surface must not claim a global chord
// (see dashboard.toggle); one click here binds them once the user opts in.
const SUGGESTED_BINDINGS: readonly (readonly [KeybindingActionId, string])[] = [
  ['agentHub.toggle', 'Mod+Alt+J'],
  ['agentHub.nextWaiting', 'Mod+Alt+Shift+J']
]

const platform = getShortcutPlatform()

function bindingsFor(
  actionId: KeybindingActionId,
  overrides: Parameters<typeof getEffectiveKeybindingsForDefinition>[2]
): string[] {
  const definition = getKeybindingDefinition(actionId)
  return definition ? getEffectiveKeybindingsForDefinition(definition, platform, overrides) : []
}

/** Shows the hub's two shortcuts and binds the suggested chords when both are unset. */
export function AgentHubShortcutSetting(): React.JSX.Element {
  const keybindings = useAppStore((s) => s.keybindings)
  const setKeybindingOverride = useAppStore((s) => s.setKeybindingOverride)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const [error, setError] = useState<string | null>(null)
  const current = SUGGESTED_BINDINGS.map(([actionId]) => bindingsFor(actionId, keybindings))
  const unbound = current.every((bindings) => bindings.length === 0)
  const suggestedLabel = formatKeybindingList(
    SUGGESTED_BINDINGS.map(([, binding]) => binding),
    platform
  )

  const applySuggested = async (): Promise<void> => {
    const next = { ...keybindings }
    for (const [actionId, binding] of SUGGESTED_BINDINGS) {
      next[actionId] = [binding]
    }
    const conflict = findKeybindingConflicts(platform, next).find((candidate) =>
      SUGGESTED_BINDINGS.some(([actionId]) => candidate.actionIds.includes(actionId))
    )
    if (conflict) {
      const owners = conflict.actionIds
        .filter((actionId) => !SUGGESTED_BINDINGS.some(([own]) => own === actionId))
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
      for (const [actionId, binding] of SUGGESTED_BINDINGS) {
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
        (unbound
          ? translate(
              'auto.components.settings.ExperimentalPane.agentHub.shortcutsUnset',
              'Not set. Suggested: {{value0}} (open the hub, jump to the next agent waiting).',
              { value0: suggestedLabel }
            )
          : translate(
              'auto.components.settings.ExperimentalPane.agentHub.shortcutsSet',
              'Open the hub: {{value0}} · Next agent waiting: {{value1}}',
              {
                value0: formatKeybindingList(current[0] ?? [], platform),
                value1: formatKeybindingList(current[1] ?? [], platform)
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
