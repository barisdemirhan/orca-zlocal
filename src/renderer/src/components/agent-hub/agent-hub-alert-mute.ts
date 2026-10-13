import { translate } from '@/i18n/i18n'

export const AGENT_HUB_MUTE_CHOICES = ['hour', 'twoHours', 'tomorrow'] as const
export type AgentHubMuteChoice = (typeof AGENT_HUB_MUTE_CHOICES)[number]

export function agentHubMuteChoiceLabel(choice: AgentHubMuteChoice): string {
  switch (choice) {
    case 'hour':
      return translate('auto.agentHub.alerts.muteHour', '1 h')
    case 'twoHours':
      return translate('auto.agentHub.alerts.muteTwoHours', '2 h')
    case 'tomorrow':
      return translate('auto.agentHub.alerts.muteTomorrow', 'Until tomorrow at 09:00')
  }
}

export function agentHubMuteUntil(choice: AgentHubMuteChoice, now: number): number {
  if (choice !== 'tomorrow') {
    return now + (choice === 'hour' ? 1 : 2) * 60 * 60 * 1000
  }
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  return tomorrow.getTime()
}
