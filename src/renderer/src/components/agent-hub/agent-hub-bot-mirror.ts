import { toast } from 'sonner'
import { openBotChat } from '@/lib/bot-catalog'
import { openDesktopStructuredSessionInteraction } from '@/lib/agent-session/open/open-existing-structured-session'
import { structuredSessionOpenFeedbackText } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { useAppStore } from '@/store'
import type { Bot } from '../../../../shared/bot-types'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { popOutAgentHubTab } from './agent-hub-tab-popout'

function findChatTarget(tabId: string): AgentHubPaneTarget | null {
  const find = (rows: readonly AgentHubTerminalRow[]): AgentHubPaneTarget | null => {
    for (const row of rows) {
      const target = paneTargetFromTerminalRow(row)
      if (target.tab.id === tabId) {
        return target
      }
      const child = find(row.children)
      if (child) {
        return child
      }
    }
    return null
  }
  for (const group of agentHubTerminalTreeFromState(useAppStore.getState(), [], true, new Map())) {
    for (const workspace of group.workspaces) {
      const found = find(workspace.rows)
      if (found) {
        return found
      }
    }
  }
  return null
}

/** Shows one of the bot's chats (its Home chat when `sessionId` is null) in a mirror, opening its
 *  tab in the background so the workspace on screen stays where it is. */
export async function mirrorBotChat(bot: Bot, sessionId: string | null): Promise<void> {
  const unavailable = (): void => {
    toast.error(structuredSessionOpenFeedbackText.unavailable())
  }
  const id = sessionId ?? (await openBotChat(bot).catch(() => null))
  if (!id) {
    unavailable()
    return
  }
  const result = await openDesktopStructuredSessionInteraction(
    {
      kind: 'history',
      structuredSession: { sessionId: id, workspaceId: folderWorkspaceKey(bot.folderWorkspaceId) }
    },
    { present: () => undefined }
  ).catch(() => null)
  const target = result?.kind === 'opened' ? findChatTarget(result.tab.id) : null
  if (!target) {
    unavailable()
    return
  }
  popOutAgentHubTab(target)
}
