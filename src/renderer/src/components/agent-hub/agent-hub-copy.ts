import { translate } from '@/i18n/i18n'
import type { AgentHubTab } from './agent-hub-keys'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import {
  activityThreadStatusId,
  threadAgentStateLabel
} from '../activity/threads/activity-thread-presentation'
import { agentHubIndicatorKind, agentHubIsApproval } from './agent-hub-lists'

/** Said when the tray drops its oldest chip to make room for a new one. */
export function agentHubMirrorTrayFullReason(): string {
  return translate(
    'agentHub.mirror.trayFull',
    'The oldest minimized mirror was closed to make room. Its terminals are still in their workspaces.'
  )
}

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

export function agentHubTabLabel(tab: AgentHubTab): string {
  switch (tab) {
    case 'inbox':
      return translate('agentHub.tab.inbox', 'Inbox')
    case 'running':
      return translate('agentHub.tab.running', 'Running')
    case 'agents':
      return translate('agentHub.tab.agents', 'Agents')
    case 'all':
      return translate('agentHub.tab.all', 'All terminals')
  }
}
