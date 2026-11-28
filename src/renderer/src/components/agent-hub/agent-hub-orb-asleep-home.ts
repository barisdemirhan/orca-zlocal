import {
  openDesktopStructuredSessionInteraction,
  defaultStructuredSessionOpenDeps
} from '@/lib/agent-session/open/open-existing-structured-session'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import type { Bot } from '../../../../shared/bot-types'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/workspace-mounting/background-terminal-worktree-mount'
import { activateAgentHubOrbStripChat } from './agent-hub-orb-chat-strip-store'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

/** Shows the sleeping Orb's Home chat from its journal; `reveal` only reads it, so no provider starts. */
export async function showAgentHubOrbAsleepHome(bot: Bot, chatId: string): Promise<void> {
  activateAgentHubOrbStripChat(AGENT_HUB_ORB_HOME_CHAT)
  const result = await openDesktopStructuredSessionInteraction(
    {
      kind: 'history',
      structuredSession: {
        sessionId: chatId,
        workspaceId: folderWorkspaceKey(bot.folderWorkspaceId)
      }
    },
    {
      target: { kind: 'local' },
      deps: { ...defaultStructuredSessionOpenDeps, activate: () => true },
      present: () => {}
    }
  ).catch(() => null)
  if (result?.kind !== 'opened') {
    return
  }
  requestBackgroundTerminalWorktreeMount({
    worktreeId: result.target.worktreeId,
    tabIds: [result.tab.id]
  })
  if (useAgentHubOrbPanel.getState().asleep) {
    useAgentHubOrbPanel.setState({ shownTabId: result.tab.id })
  }
}
