import { agentHubMirrorTabCommandAvailable } from './agent-hub-mirror-tab-command'
import type { KeybindingActionId } from '../../../../shared/keybindings/types'
import {
  fileSearchClaimsTextKey,
  type TextKeyEvent
} from '@/lib/keyboard/text-field-shortcut-policy'
import { getAgentHubCommands, type AgentHubCommands } from './agent-hub-commands'
import {
  agentHubOrbConversationCommandAvailable,
  agentHubOrbVoiceCommandAvailable
} from './agent-hub-orb-voice-commands'

const ACTIONS = [
  ['agentHub.openAnswerQueue', 'openAnswerQueue'],
  ['agentHub.toggleOrb', 'toggleOrb'],
  ['agentHub.orb.toggleLive', 'toggleOrbLive'],
  ['agentHub.orb.toggleMicrophone', 'toggleOrbMicrophone'],
  ['agentHub.orb.toggleSpeaker', 'toggleOrbSpeaker'],
  ['agentHub.orb.toggleConversation', 'toggleOrbConversation'],
  ['agentHub.toggle', 'toggle'],
  ['agentHub.nextWaiting', 'jumpToNextWaiting'],
  ['agentHub.dockMirrors', 'toggleMirrors'],
  ['agentHub.toggleCanvas', 'toggleCanvas'],
  ['agentHub.arrangeMirrors', 'arrangeMirrors'],
  ['agentHub.focusMirror', 'focusMirror'],
  ['agentHub.popOut', 'popOut'],
  ['agentHub.jumpToMirror', 'jumpToMirror'],
  ['agentHub.nextMirrorTab', 'nextMirrorTab'],
  ['agentHub.previousMirrorTab', 'previousMirrorTab']
] as const satisfies readonly (readonly [KeybindingActionId, keyof AgentHubCommands])[]

export const AGENT_HUB_COMMAND_ACTION_IDS = ACTIONS.map(([actionId]) => actionId)
// Orb chords also run from text fields, so the Orb composer can start Live or switch views.
export const AGENT_HUB_ORB_VOICE_ACTION_IDS = AGENT_HUB_COMMAND_ACTION_IDS.filter(
  (id) => id === 'agentHub.toggleOrb' || id.startsWith('agentHub.orb.')
)

export function withAgentHubActionIds(
  ids: readonly KeybindingActionId[]
): readonly KeybindingActionId[] {
  return [...AGENT_HUB_COMMAND_ACTION_IDS, ...ids]
}

/** Runs an Orb voice chord from a text field, where every other app shortcut yields. */
export function runAgentHubOrbVoiceChord(
  input: TextKeyEvent,
  targetYields: boolean,
  matches: (actionId: KeybindingActionId) => boolean,
  handlers: () => ReadonlyMap<KeybindingActionId, () => boolean>
): boolean {
  if (!targetYields || !fileSearchClaimsTextKey(input)) {
    return false
  }
  const map = handlers()
  return AGENT_HUB_ORB_VOICE_ACTION_IDS.some((id) => matches(id) && map.get(id)?.() === true)
}

export function agentHubCommandHandlers(
  claim: (actionId: KeybindingActionId, run: () => void) => boolean
): [KeybindingActionId, () => boolean][] {
  return ACTIONS.map(([actionId, command]) => [
    actionId,
    () => {
      if (
        (command === 'toggleOrbLive' ||
          command === 'toggleOrbMicrophone' ||
          command === 'toggleOrbSpeaker') &&
        !agentHubOrbVoiceCommandAvailable(command)
      ) {
        return false
      }
      if (command === 'toggleOrbConversation' && !agentHubOrbConversationCommandAvailable()) {
        return false
      }
      if (
        (command === 'nextMirrorTab' || command === 'previousMirrorTab') &&
        !agentHubMirrorTabCommandAvailable()
      ) {
        return false
      }
      const run = getAgentHubCommands()?.[command]
      return run ? claim(actionId, run) : false
    }
  ])
}
