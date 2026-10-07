import type { KeybindingActionId } from '../../../../shared/keybindings'
import { getShortcutPlatform } from '@/lib/shortcut-platform'

export function agentHubSuggestedBindings(
  platform: NodeJS.Platform
): readonly (readonly [KeybindingActionId, string])[] {
  // Cmd+Option avoids typed Option characters on Mac; Alt+Shift avoids AltGr elsewhere.
  return platform === 'darwin'
    ? [
        ['agentHub.toggle', 'Mod+Alt+U'],
        ['agentHub.nextWaiting', 'Mod+Alt+N'],
        ['agentHub.dockMirrors', 'Mod+Alt+B'],
        ['agentHub.toggleCanvas', 'Mod+Alt+V'],
        ['agentHub.arrangeMirrors', 'Mod+Alt+G'],
        ['agentHub.focusMirror', 'Mod+Alt+O'],
        ['agentHub.popOut', 'Mod+Alt+P'],
        ['agentHub.jumpToMirror', 'Mod+Alt+J']
      ]
    : [
        ['agentHub.toggle', 'Alt+Shift+H'],
        ['agentHub.nextWaiting', 'Alt+Shift+W'],
        ['agentHub.dockMirrors', 'Alt+Shift+M'],
        ['agentHub.toggleCanvas', 'Alt+Shift+V'],
        ['agentHub.arrangeMirrors', 'Alt+Shift+G'],
        ['agentHub.focusMirror', 'Alt+Shift+U'],
        ['agentHub.popOut', 'Alt+Shift+P'],
        ['agentHub.jumpToMirror', 'Alt+Shift+J']
      ]
}

export const AGENT_HUB_SUGGESTED_BINDINGS = agentHubSuggestedBindings(getShortcutPlatform())
