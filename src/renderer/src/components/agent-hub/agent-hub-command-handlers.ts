import { agentHubMirrorTabCommandAvailable } from './agent-hub-mirror-tab-command'
import type { KeybindingActionId } from '../../../../shared/keybindings'
import { getAgentHubCommands, type AgentHubCommands } from './agent-hub-commands'
import { agentHubOrbVoiceCommandAvailable } from './agent-hub-orb-voice-commands'

const ACTIONS = [
  ['agentHub.openAnswerQueue', 'openAnswerQueue'],
  ['agentHub.toggleOrb', 'toggleOrb'],
  ['agentHub.orb.toggleLive', 'toggleOrbLive'],
  ['agentHub.orb.toggleMicrophone', 'toggleOrbMicrophone'],
  ['agentHub.orb.toggleSpeaker', 'toggleOrbSpeaker'],
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
export const AGENT_HUB_ORB_VOICE_ACTION_IDS = AGENT_HUB_COMMAND_ACTION_IDS.filter((id) =>
  id.startsWith('agentHub.orb.')
)

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
