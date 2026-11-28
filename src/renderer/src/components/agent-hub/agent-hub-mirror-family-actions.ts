import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubThreadCardActions } from './AgentHubThreadHoverCard'
import {
  findAgentHubMirrorMembership,
  type AgentHubMirrorState
} from './agent-hub-mirror-membership'
import { paneTargetFromThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { addAgentHubMirrorTabWithFeedback } from './agent-hub-mirror-tab-actions'
import { openAgentHubMirrorInLayout } from './agent-hub-floating-arrangement'

export function agentHubMirrorFamilyActions({
  member,
  state,
  windowId,
  onScreenTab,
  onReveal
}: {
  member: AgentPaneThread
  state: AgentHubMirrorState
  windowId: string
  onScreenTab: string | null
  onReveal: (target: AgentHubPaneTarget, thread: AgentPaneThread | null) => void
}): AgentHubThreadCardActions {
  const target = paneTargetFromThread(member, activityThreadRowCopy(member).taskTitle)
  const owner = findAgentHubMirrorMembership(state, target)
  const onScreen = onScreenTab === `${member.worktree.id}\u0000${member.tab.id}`
  return {
    ...(owner || onScreen ? {} : { onJump: () => onReveal(target, member) }),
    ...(owner?.kind === 'tab'
      ? {}
      : {
          onOpenTab: () => addAgentHubMirrorTabWithFeedback(windowId, target),
          onPopout: () => openAgentHubMirrorInLayout(target)
        })
  }
}
