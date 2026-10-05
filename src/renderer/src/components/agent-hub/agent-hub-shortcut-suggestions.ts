import type { KeybindingActionId } from '../../../../shared/keybindings'

/**
 * The chords the hub's settings offer for its actions, in the order the settings row lists them.
 * Why suggested, not default: an experimental surface must not claim a global chord
 * (see dashboard.toggle); one click in the settings binds the ones still unset.
 */
export const AGENT_HUB_SUGGESTED_BINDINGS: readonly (readonly [KeybindingActionId, string])[] = [
  ['agentHub.toggle', 'Mod+Alt+J'],
  ['agentHub.nextWaiting', 'Mod+Alt+Shift+J'],
  ['agentHub.dockMirrors', 'Mod+Alt+K'],
  // Shift on the mirrors chord, as "next waiting" is Shift on the hub's.
  ['agentHub.arrangeMirrors', 'Mod+Alt+Shift+K']
]
