import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { useEditablePluginCommands } from '@/store/plugins/catalog/plugin-contribution-catalog'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import { KEYBINDING_DEFINITIONS } from '../../../../shared/keybindings/definitions'
import { buildPluginCommandKeybindingDefinitions } from '@/lib/plugins/commands/plugin-command-keybindings'
import { initializeAgentHubShortcutsOnce } from './agent-hub-shortcut-initialization'

export function useAgentHubShortcutInitialization(): void {
  const enabled = useAppStore((state) => state.settings?.experimentalAgentHub === true)
  const initialized = useAppStore((state) => state.settings?.agentHubShortcutsInitialized === true)
  const hydrated = useAppStore((state) => state.keybindingSnapshot !== null)
  const pluginCommands = useEditablePluginCommands()
  useEffect(() => {
    if (!enabled || initialized || !hydrated || isPairedWebClientWindow()) {
      return
    }
    void initializeAgentHubShortcutsOnce(
      useAppStore.getState,
      [...KEYBINDING_DEFINITIONS, ...buildPluginCommandKeybindingDefinitions(pluginCommands)],
      getShortcutPlatform()
    ).catch((error: unknown) => console.error('Failed to initialize Agent Hub shortcuts:', error))
  }, [enabled, initialized, hydrated, pluginCommands])
}

export function AgentHubShortcutInitialization(): null {
  useAgentHubShortcutInitialization()
  return null
}
