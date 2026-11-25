import type { AgentHubDockCounters } from '../../../../shared/agent-hub-surface-settings'
import { mergeAgentHubInboxDuplicates, type AgentHubInboxEntry } from './agent-hub-inbox-groups'
import type { AgentHubCounts } from './agent-hub-lists'

export type AgentHubInboxCounts = {
  agentAsks: number
  /** Bot asks after duplicates merged; suggestions never count. */
  botAsks: number
  /** Agents and bots together: the Inbox tab. */
  inbox: number
  /** What the dock's three counts show. */
  dock: AgentHubCounts
}

/** The one computation behind the dock, the status trigger and the panel's tabs and badges. */
export function agentHubInboxCounts(
  entries: readonly AgentHubInboxEntry<unknown>[],
  rest: {
    working: number
    nestedWorking: number
    /** Unread results of agents, plus answers given while away. */
    finished: number
    dockCounters: AgentHubDockCounters
  }
): AgentHubInboxCounts {
  const asks = mergeAgentHubInboxDuplicates(entries).filter((entry) => entry.kind === 'ask')
  const botAsks = asks.filter((entry) => entry.side === 'bots').length
  const agentAsks = asks.length - botAsks
  return {
    agentAsks,
    botAsks,
    inbox: agentAsks + botAsks,
    dock: {
      needsYou: rest.dockCounters === 'agents-and-bots' ? agentAsks + botAsks : agentAsks,
      working: rest.working,
      finished: rest.finished,
      nestedWorking: rest.nestedWorking
    }
  }
}
