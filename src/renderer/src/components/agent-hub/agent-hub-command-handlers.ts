import { agentHubMirrorTabCommandAvailable } from './agent-hub-mirror-tab-command'
import type { KeybindingActionId } from '../../../../shared/keybindings'
import { getAgentHubCommands, type AgentHubCommands } from './agent-hub-commands'

const ACTIONS = [
  ['agentHub.openAnswerQueue', 'openAnswerQueue'],
  ['agentHub.toggleOrb', 'toggleOrb'],
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

export function agentHubCommandHandlers(
  claim: (actionId: KeybindingActionId, run: () => void) => boolean
): [KeybindingActionId, () => boolean][] {
  return ACTIONS.map(([actionId, command]) => [
    actionId,
    () => {
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
