import { translate } from '@/i18n/i18n'
import type { AgentHubOrbAction } from '../../../../shared/agent-hub-settings'

export function agentHubOrbActionLabel(action: AgentHubOrbAction): string {
  return action === 'live'
    ? translate('agentHub.orb.liveAction', 'Live')
    : action === 'dictate'
      ? translate('agentHub.card.dictate', 'Dictate')
      : translate('agentHub.orb.textAction', 'Text')
}
