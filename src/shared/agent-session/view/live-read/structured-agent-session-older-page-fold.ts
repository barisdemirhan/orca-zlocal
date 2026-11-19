import { mergeItems, hostClockField } from '../structured-agent-session-history-state'
import { mergeSubmissions, ownItemCount } from '../structured-agent-session-item-retention'
import { agentSessionHasOlderTranscript } from '../../conversation-context/agent-session-context-clear'
import { foldStructuredAgentSubagentRosterPage } from '../structured-agent-session-subagent-roster'
import type {
  StructuredAgentSessionAction,
  StructuredAgentSessionState
} from './structured-agent-session-reducer'

export function foldOlderStructuredAgentSessionPage(
  state: StructuredAgentSessionState,
  action: Extract<StructuredAgentSessionAction, { type: 'older-page' }>,
  receivedAt: number
): StructuredAgentSessionState {
  const requested = action.requestedCursor
  if (state.epoch !== requested.epoch || action.page.epoch !== requested.epoch) {
    return state
  }
  const head = state.items[0]
  // Head trim overtook the requested anchor; merging would leave a hole. Caller must retry from the new head.
  if (head && head.sequence > requested.sequence) {
    return state
  }
  const items = mergeItems(state.items, action.page.items, action.page.removedItemIds)
  return {
    ...state,
    items,
    retainedOwnItemLimit: Math.max(state.retainedOwnItemLimit, ownItemCount(items)),
    retainedItemCap: Math.max(state.retainedItemCap, items.length),
    subagentRoster: foldStructuredAgentSubagentRosterPage(state.subagentRoster, action.page),
    submissions: mergeSubmissions(state.submissions, action.page.submissions, items),
    hasOlder: agentSessionHasOlderTranscript(items, action.page.hasOlder),
    ...hostClockField(action.page.hostNow, receivedAt, state.hostClock)
  }
}
