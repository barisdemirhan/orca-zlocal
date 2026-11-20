import { translate } from '@/i18n/i18n'
import type { AgentHubFloatingDimMode } from '../../../../shared/agent-hub-settings'

export const AGENT_HUB_DIM_MODES: readonly AgentHubFloatingDimMode[] = [
  'off',
  'on',
  'untilClick',
  'minimizeOnClick'
]

export function agentHubDimModeLabel(mode: AgentHubFloatingDimMode): string {
  switch (mode) {
    case 'off':
      return translate('agentHub.dim.modeOff', "Don't dim")
    case 'on':
      return translate('agentHub.dim.modeOn', 'Dim behind floating windows')
    case 'untilClick':
      return translate('agentHub.dim.modeUntilClick', 'Dim until I click behind them')
    case 'minimizeOnClick':
      return translate(
        'agentHub.dim.modeMinimizeOnClick',
        'Dim, and a click behind tucks them away'
      )
  }
}
