import { translate } from '@/i18n/i18n'
import {
  KEYBINDING_DEFINITIONS,
  agentTabActionId,
  type KeybindingActionId,
  type KeybindingDefinition
} from '../../../../shared/keybindings'
import { normalizeDisabledTuiAgents } from '../../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { localizeKeybindingDefinition } from './keybinding-title-copy'

export type ShortcutGroup = {
  title: string
  items: KeybindingDefinition[]
}

export const EMPTY_DISABLED_TUI_AGENTS: readonly TuiAgent[] = []

export function disabledAgentTabActionIds(
  disabledTuiAgents: readonly TuiAgent[]
): KeybindingActionId[] {
  return normalizeDisabledTuiAgents(disabledTuiAgents).map((agent) => agentTabActionId(agent))
}

const TRANSLATED_TITLES: Partial<Record<KeybindingActionId, () => string>> = {
  'agentHub.toggleOrb': () => translate('auto.agentHub.orb.toggle', 'Toggle Agent Hub Orb'),
  'agentHub.openAnswerQueue': () =>
    translate('agentHub.answerQueue.openShortcut', 'Open the Agent Hub Answer Queue')
}

export function groupDefinitions(
  disabledTuiAgents: readonly TuiAgent[],
  additionalDefinitions: readonly KeybindingDefinition[] = []
): ShortcutGroup[] {
  // Hide launch bindings for disabled agents because those chords cannot launch them.
  const hiddenAgentActionIds = new Set<KeybindingActionId>(
    disabledAgentTabActionIds(disabledTuiAgents)
  )
  const groups = new Map<string, KeybindingDefinition[]>()
  for (const definition of [...KEYBINDING_DEFINITIONS, ...additionalDefinitions]) {
    if (hiddenAgentActionIds.has(definition.id)) {
      continue
    }
    const localized = localizeKeybindingDefinition(definition)
    const translatedTitle = TRANSLATED_TITLES[localized.id]
    const item = translatedTitle ? { ...localized, title: translatedTitle() } : localized
    groups.set(localized.group, [...(groups.get(localized.group) ?? []), item])
  }
  return Array.from(groups.entries()).map(([title, items]) => ({
    title: title === 'Agent Hub' ? translate('auto.agentHub.shortcuts.group', 'Agent Hub') : title,
    items
  }))
}
