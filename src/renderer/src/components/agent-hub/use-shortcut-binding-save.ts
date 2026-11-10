import { useState } from 'react'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import {
  findKeybindingConflictsForDefinitions,
  formatKeybindingList,
  getEffectiveKeybindingsForDefinition,
  getKeybindingResetBindings,
  normalizeKeybindingListForAction,
  resolveKeybindingOverrides,
  type KeybindingActionId,
  type KeybindingOverrides
} from '../../../../shared/keybindings'
import type { ShortcutDefinitionCatalog } from '../settings/shortcuts/shortcut-definition-catalog'
import { keybindingValidationErrorText } from '../settings/shortcuts/keybinding-diagnostic-text'
import {
  hasCommonBindingOverride,
  removeBindingOverride,
  sameBindings
} from '../settings/shortcuts/keybinding-override-edits'

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
    const conflict = findKeybindingConflictsForDefinitions(
      catalog.definitions,
      platform,
      resolveKeybindingOverrides(platform, next, snapshot?.defaultOverrides ?? {}),
      {
        ignoredActionIds: catalog.ignoredConflictActionIds,
        includeMainProcessInterception: true
      }
    ).find((candidate) => candidate.actionIds.some((id) => actionIds.includes(id)))
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
    const explicitOverrides = snapshot?.defaultOverrides
      ? { ...snapshot.commonOverrides, ...snapshot.platformOverrides[platform] }
      : keybindings
    const shouldReset =
      sameBindings(normalized, defaults) && !hasCommonBindingOverride(snapshot, actionId)
    const nextBindings = shouldReset
      ? getKeybindingResetBindings(actionId, platform, snapshot?.commonOverrides ?? {})
      : normalized
    const next =
      nextBindings === null
        ? removeBindingOverride(explicitOverrides, actionId)
        : { ...explicitOverrides, [actionId]: nextBindings }
    if (!checkConflicts([actionId], next)) {
      return false
    }
    setErrors((previous) => ({ ...previous, [actionId]: undefined }))
    try {
      await (shouldReset ? resetOverride(actionId) : setOverride(actionId, normalized))
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
