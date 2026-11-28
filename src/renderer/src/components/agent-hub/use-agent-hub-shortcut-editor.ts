import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useEditablePluginCommands } from '@/store/plugins/catalog/plugin-contribution-catalog'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import { getEffectiveKeybindingsForDefinition } from '../../../../shared/keybindings/effective'
import { keybindingFromInputForAction } from '../../../../shared/keybindings/input'
import type { KeybindingActionId, KeybindingInput } from '../../../../shared/keybindings/types'
import { buildShortcutDefinitionCatalog } from '../settings/shortcuts/shortcut-definition-catalog'
import { EMPTY_DISABLED_TUI_AGENTS } from '../settings/shortcuts/shortcut-groups'
import { useMacCapturedDigitChords } from '../settings/shortcuts/use-mac-captured-digit-chords'
import { clearRecordingActionForShortcutMutation } from '../settings/shortcuts/shortcut-recording-state'
import {
  adjustRecordingIndexAfterRemove,
  appendBinding,
  removeBindingAt,
  replaceBindingAt
} from '../settings/shortcuts/shortcut-binding-list-mutations'
import { useShortcutBindingSave } from './use-shortcut-binding-save'

const platform = getShortcutPlatform()

export function useAgentHubShortcutEditor() {
  const keybindings = useAppStore((s) => s.keybindings)
  const disabledTuiAgents = useAppStore(
    (s) => s.settings?.disabledTuiAgents ?? EMPTY_DISABLED_TUI_AGENTS
  )
  const pluginCommands = useEditablePluginCommands()
  const macCapturedDigitChords = useMacCapturedDigitChords({ enabled: platform === 'darwin' })
  const catalog = useMemo(
    () =>
      buildShortcutDefinitionCatalog({
        disabledTuiAgents,
        pluginCommands,
        keybindings,
        platform,
        macCapturedDigitChords,
        missionControlConflictMessage: translate(
          'auto.components.settings.shortcutDefinitionCatalog.missionControlConflict',
          'Blocked by Mission Control. Remap here or change it in System Settings.'
        )
      }),
    [disabledTuiAgents, pluginCommands, keybindings, macCapturedDigitChords]
  )
  const { errors, setErrors, saveBindings, checkConflicts } = useShortcutBindingSave(
    platform,
    catalog
  )
  const [recordingActionId, setRecordingActionId] = useState<KeybindingActionId | null>(null)
  const [recordingBindingIndex, setRecordingBindingIndex] = useState<number | null>(null)
  const mountedRef = useMountedRef()
  useEffect(() => {
    window.api.ui.setShortcutRecorderFocused(recordingActionId !== null)
    return () => window.api.ui.setShortcutRecorderFocused(false)
  }, [recordingActionId])
  const bindingsFor = (actionId: KeybindingActionId): string[] => {
    const definition = catalog.definitionsByAction.get(actionId)
    return definition ? getEffectiveKeybindingsForDefinition(definition, platform, keybindings) : []
  }
  const clearError = (actionId: KeybindingActionId): void => {
    setErrors((previous) => ({ ...previous, [actionId]: undefined }))
  }
  const cancelRecording = (): void => {
    setRecordingActionId(null)
    setRecordingBindingIndex(null)
  }
  const capture = async (actionId: KeybindingActionId, input: KeybindingInput): Promise<void> => {
    const captured = keybindingFromInputForAction(actionId, input, platform)
    if (!captured.ok) {
      setErrors((previous) => ({ ...previous, [actionId]: captured.error }))
      return
    }
    const current = bindingsFor(actionId)
    const next =
      recordingBindingIndex === null || recordingBindingIndex >= current.length
        ? appendBinding(current, captured.value)
        : replaceBindingAt(current, recordingBindingIndex, captured.value)
    if ((await saveBindings(actionId, next)) && mountedRef.current) {
      cancelRecording()
    }
  }
  const remove = (actionId: KeybindingActionId, index: number): void => {
    if (recordingActionId === actionId) {
      const nextIndex = adjustRecordingIndexAfterRemove(recordingBindingIndex, index)
      setRecordingBindingIndex(nextIndex)
      if (nextIndex === null) {
        setRecordingActionId((current) =>
          clearRecordingActionForShortcutMutation(current, actionId)
        )
      }
    }
    void saveBindings(actionId, removeBindingAt(bindingsFor(actionId), index))
  }
  return {
    platform,
    catalog,
    bindingsFor,
    errors,
    recordingActionId,
    recordingBindingIndex,
    saveBindings,
    checkConflicts,
    keybindings,
    clearError,
    cancelRecording,
    capture,
    remove,
    startRecording: (actionId: KeybindingActionId, index: number): void => {
      clearError(actionId)
      setRecordingActionId(actionId)
      setRecordingBindingIndex(index)
    }
  }
}

export type AgentHubShortcutEditor = ReturnType<typeof useAgentHubShortcutEditor>
