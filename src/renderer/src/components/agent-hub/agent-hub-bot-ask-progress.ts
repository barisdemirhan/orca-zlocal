import type { AgentHubBotAskPhase } from './use-agent-hub-bot-ask-steps'

export type AgentHubBotAskProgress = 'open' | 'partial' | 'answered' | 'gone'

/** Whether every question of an ask is answered. The item leaving Needs you after a "Send now" does
 *  not mean that: lines still open keep the ask `partial`. */
export function agentHubBotAskProgress(ask: {
  phase: AgentHubBotAskPhase
  waiting: boolean
  total: number
  answeredCount: number
}): AgentHubBotAskProgress {
  switch (ask.phase) {
    case 'answered':
      return 'answered'
    case 'closed':
      return 'gone'
    case 'open':
      return !ask.waiting && ask.answeredCount > 0 && ask.answeredCount < ask.total
        ? 'partial'
        : 'open'
    default:
      return 'open'
  }
}
