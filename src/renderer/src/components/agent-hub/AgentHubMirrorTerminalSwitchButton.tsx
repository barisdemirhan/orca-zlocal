import { useAppStore } from '@/store'
import { agentForksConversations } from '../../../../shared/agent-launch/startup/agent-resume-argv'
import { NativeChatResumeInCliButton } from '../native-chat/pane/actions/NativeChatResumeInCliButton'
import { agentHubChatSession, findAgentHubChatTab } from './agent-hub-chat-tabs'
import {
  agentHubChatSwitchBlockedReason,
  useAgentHubChatWorking
} from './agent-hub-chat-work-state'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/** A chat in a mirror has no pane header, so its way to the terminal sits in the mirror's. */
export function AgentHubMirrorTerminalSwitchButton({
  target
}: {
  target: AgentHubPaneTarget
}): React.JSX.Element | null {
  const chat = useAppStore((state) => findAgentHubChatTab(state, target.tab.id))
  const working = useAgentHubChatWorking(chat?.id ?? null)
  if (!chat?.agentSessionAgent || !agentForksConversations(chat.agentSessionAgent)) {
    return null
  }
  return (
    <NativeChatResumeInCliButton
      tabId={chat.id}
      worktreeId={target.worktree.id}
      nativeChat={agentHubChatSession(chat)}
      fromMirror
      blockedReason={working ? agentHubChatSwitchBlockedReason() : undefined}
    />
  )
}
