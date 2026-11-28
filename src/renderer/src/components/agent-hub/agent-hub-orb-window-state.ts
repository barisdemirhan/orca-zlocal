import { translate } from '@/i18n/i18n'
import type { Bot } from '../../../../shared/bot-types'
import type { AgentHubOrbState } from './agent-hub-orb-state'

/** The state line under the Orb's name: working, asking, sleeping or paused. */
export function agentHubOrbWindowStateLabel(
  bot: Bot,
  state: AgentHubOrbState,
  asking: boolean
): string {
  if (state.kind === 'off') {
    return translate('agentHub.orb.window.asleep', 'Asleep')
  }
  if (bot.paused) {
    return translate('agentHub.bots.page.paused', 'Paused')
  }
  if (asking || state.kind === 'needsYou') {
    return translate('agentHub.orb.window.asking', 'Asking')
  }
  return state.kind === 'working'
    ? translate('agentHub.orb.window.working', 'Working')
    : translate('agentHub.bots.page.idle', 'Idle')
}
