import type { KeybindingActionId } from '../../../../shared/keybindings'

/**
 * The chords the hub's settings offer for its actions, in the order the settings row lists them.
 * Why suggested, not default: an experimental surface must not claim a global chord
 * (see dashboard.toggle); one click in the settings binds the ones still unset.
 */
export const AGENT_HUB_SUGGESTED_BINDINGS: readonly (readonly [KeybindingActionId, string])[] = [
  ['agentHub.toggle', 'Mod+U'],
  ['agentHub.nextWaiting', 'Mod+F8'],
  ['agentHub.dockMirrors', 'Mod+F9'],
  ['agentHub.toggleCanvas', 'Mod+F10'],
  ['agentHub.arrangeMirrors', 'Mod+F11'],
  ['agentHub.focusMirror', 'Mod+F12'],
  ['agentHub.popOut', 'Mod+F7'],
  ['agentHub.jumpToMirror', 'Mod+F6']
]
