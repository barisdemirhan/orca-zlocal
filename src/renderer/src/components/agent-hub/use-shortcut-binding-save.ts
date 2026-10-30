import { useState } from 'react'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import {
  findKeybindingConflictsForDefinitions,
  formatKeybindingList,
  getEffectiveKeybindingsForDefinition,
  normalizeKeybindingListForAction,
  type KeybindingActionId,
  type KeybindingOverrides
} from '../../../../shared/keybindings'
import type { ShortcutDefinitionCatalog } from '../settings/shortcut-definition-catalog'
import { keybindingValidationErrorText } from '../settings/keybinding-diagnostic-text'
import {
  hasCommonBindingOverride,
  removeBindingOverride,
  sameBindings
} from '../settings/keybinding-override-edits'

/** One save path for the Keyboard Shortcuts pane and the hub's inline editor. */
export function useShortcutBindingSave(
  platform: NodeJS.Platform,
  catalog: ShortcutDefinitionCatalog
) {
  const keybindings = useAppStore((s) => s.keybindings)
  const snapshot = useAppStore((s) => s.keybindingSnapshot)
  const setOverride = useAppStore((s) => s.setKeybindingOverride)
  const resetOverride = useAppStore((s) => s.resetKeybindingOverride)
  const mountedRef = useMountedRef()
  const [errors, setErrors] = useState<Partial<Record<KeybindingActionId, string>>>({})
  const checkConflicts = (actionIds: KeybindingActionId[], next: KeybindingOverrides): boolean => {
    const conflict = findKeybindingConflictsForDefinitions(catalog.definitions, platform, next, {
      ignoredActionIds: catalog.ignoredConflictActionIds
    }).find((candidate) => candidate.actionIds.some((id) => actionIds.includes(id)))
    if (conflict) {
      const actionId = conflict.actionIds.find((id) => actionIds.includes(id))
      if (!actionId) {
        return true
      }
      const owners = conflict.actionIds
        .filter((id) => id !== actionId)
        .map((id) => catalog.definitionsByAction.get(id)?.title ?? id)
        .join(', ')
      setErrors((previous) => ({
        ...previous,
        [actionId]: translate(
          'agentHub.shortcut.conflict',
          '{{binding}} conflicts with {{owners}}.',
          {
            binding: formatKeybindingList([conflict.binding], platform),
            owners
          }
        )
      }))
      return false
    }
    return true
  }
  const saveBindings = async (
    actionId: KeybindingActionId,
    bindings: string[]
  ): Promise<boolean> => {
    const normalized = normalizeKeybindingListForAction(actionId, bindings.join(', '))
    if (!Array.isArray(normalized)) {
      setErrors((previous) => ({
        ...previous,
        [actionId]: normalized.ok
          ? translate('agentHub.shortcut.parseError', 'Unable to parse shortcut.')
          : keybindingValidationErrorText(normalized)
      }))
      return false
    }
    const definition = catalog.definitionsByAction.get(actionId)
    if (!definition) {
      setErrors((previous) => ({
        ...previous,
        [actionId]: translate(
          'auto.components.settings.ShortcutsPane.shortcutUnavailable',
          'Shortcut is no longer available.'
        )
      }))
      return false
    }
    const defaults = getEffectiveKeybindingsForDefinition(definition, platform, {})
    const matchesDefault =
      sameBindings(normalized, defaults) || (normalized.length === 0 && defaults.length === 0)
    const clearsOverride = matchesDefault && !hasCommonBindingOverride(snapshot, actionId)
    const next = clearsOverride
      ? removeBindingOverride(keybindings, actionId)
      : { ...keybindings, [actionId]: normalized }
    if (!checkConflicts([actionId], next)) {
      return false
    }
    setErrors((previous) => ({ ...previous, [actionId]: undefined }))
    try {
      await (clearsOverride ? resetOverride(actionId) : setOverride(actionId, normalized))
      return true
    } catch (failure) {
      if (mountedRef.current) {
        setErrors((previous) => ({
          ...previous,
          [actionId]:
            failure instanceof Error
              ? failure.message
              : translate('agentHub.shortcut.saveError', 'Failed to save shortcut.')
        }))
      }
      return false
    }
  }
  return { errors, setErrors, saveBindings, checkConflicts }
}
