import type { KeybindingActionId } from '../../../../shared/keybindings'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'

export function agentHubSuggestedBindings(
  platform: NodeJS.Platform
): readonly (readonly [KeybindingActionId, string])[] {
  // Cmd+Option avoids typed Option characters on Mac; Alt+Shift avoids AltGr elsewhere.
  return platform === 'darwin'
    ? [
        ['agentHub.toggle', 'Mod+Alt+U'],
        ['agentHub.nextWaiting', 'Mod+Alt+N'],
        ['agentHub.dockMirrors', 'Mod+Alt+K'],
        ['agentHub.toggleCanvas', 'Mod+Alt+V'],
        ['agentHub.arrangeMirrors', 'Mod+Alt+G'],
        ['agentHub.focusMirror', 'Mod+Alt+O'],
        ['agentHub.popOut', 'Mod+Alt+Y'],
        ['agentHub.jumpToMirror', 'Mod+Alt+J'],
        ['agentHub.nextMirrorTab', 'Mod+Alt+Shift+BracketRight'],
        ['agentHub.previousMirrorTab', 'Mod+Alt+Shift+BracketLeft']
      ]
    : [
        ['agentHub.toggle', 'Alt+Shift+H'],
        ['agentHub.nextWaiting', 'Alt+Shift+W'],
        ['agentHub.dockMirrors', 'Alt+Shift+M'],
        ['agentHub.toggleCanvas', 'Alt+Shift+V'],
        ['agentHub.arrangeMirrors', 'Alt+Shift+G'],
        ['agentHub.focusMirror', 'Alt+Shift+E'],
        ['agentHub.popOut', 'Alt+Shift+P'],
        ['agentHub.jumpToMirror', 'Alt+Shift+J'],
        ['agentHub.nextMirrorTab', 'Alt+Shift+BracketRight'],
        ['agentHub.previousMirrorTab', 'Alt+Shift+BracketLeft']
      ]
}

export const AGENT_HUB_SUGGESTED_BINDINGS = agentHubSuggestedBindings(getShortcutPlatform())
