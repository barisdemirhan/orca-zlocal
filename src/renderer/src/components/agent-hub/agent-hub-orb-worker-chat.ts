import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import {
  defaultStructuredSessionOpenDeps,
  openDesktopStructuredSessionInteraction
} from '@/lib/agent-session/open/open-existing-structured-session'
import { useAppStore } from '@/store'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeWorker } from '../../../../shared/bots/bot-chat-tree'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/workspace-mounting/background-terminal-worktree-mount'
import { openAgentHubOrbStripChat } from './agent-hub-orb-chat-strip-store'
import { orbShownTabIdFor } from './agent-hub-orb-main-tab'
import { orbStripChatStatus } from './agent-hub-orb-side-chat'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

/** Shows a local worker's chat read only in the Orb strip; false means the default open applies (terminal worker, gone, remote). */
export async function openAgentHubOrbWorkerChat(
  bot: Bot,
  worker: BotChatTreeWorker
): Promise<boolean> {
  const { dispatchId } = worker
  if (
    !dispatchId ||
    bot.hostId !== LOCAL_EXECUTION_HOST_ID ||
    worker.host === 'remote' ||
    worker.hostId
  ) {
    return false
  }
  try {
    // Why: only `activate` differs from the main-window open, so no main tab is switched to.
    const result = await openDesktopStructuredSessionInteraction(
      {
        kind: 'sender',
        party: { address: `dispatch:${dispatchId}`, terminalHandle: null, orcaSessionId: null },
        messageIds: [],
        displayName: worker.title
      },
      {
        target: { kind: 'local' },
        deps: { ...defaultStructuredSessionOpenDeps, activate: () => true },
        present: () => {}
      }
    )
    if (result.kind !== 'opened') {
      return false
    }
    const { sessionId, worktreeId, agent } = result.target
    requestBackgroundTerminalWorktreeMount({ worktreeId, tabIds: [result.tab.id] })
    const limit = agentHubSurfaceSetting(
      useAppStore.getState().settings,
      'agentHubOrbOpenChatsLimit'
    )
    if (
      !openAgentHubOrbStripChat(sessionId, limit, orbStripChatStatus, result.tab.id, worker.title, {
        dispatchId,
        worktreeId,
        agent: agent ?? worker.agent
      })
    ) {
      toast.message(
        translate(
          'agentHub.orb.strip.fullHint',
          'Every open chat is busy. Close one or wait for it to finish.'
        )
      )
      return true
    }
    useAgentHubOrbPanel.setState({ shownTabId: orbShownTabIdFor(result.tab.id) })
    return true
  } catch {
    return false
  }
}
