import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import {
  activityThreadStatusId,
  threadAgentStateLabel
} from '../activity/activity-thread-presentation'
import { agentHubIndicatorKind, agentHubIsApproval } from './agent-hub-lists'

/** The one-word state the mock shows in chips and row subtitles. */
export function agentHubStateWord(thread: AgentPaneThread | null): string {
  if (!thread) {
    return translate('agentHub.state.idle', 'idle')
  }
  if (activityThreadStatusId(thread) === 'unverifiable') {
    return threadAgentStateLabel(thread)
  }
  switch (agentHubIndicatorKind(thread)) {
    case 'ask':
      return agentHubIsApproval(thread)
        ? translate('agentHub.card.needsApproval', 'needs approval')
        : translate('agentHub.card.asking', 'asking')
    case 'work':
      return translate('agentHub.state.working', 'working')
    case 'done':
    case 'read':
      return translate('agentHub.state.done', 'done')
    case 'idle':
      return translate('agentHub.state.idle', 'idle')
  }
}
