import { useAppStore } from '@/store'
import { botRefKey } from '@/lib/bot-hosts'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { readBots, readBotsEnabled } from '@/lib/bot-catalog'
import { activityThreadStatusId } from '../activity/threads/activity-thread-presentation'
import type {
  AgentHubBotAlert,
  AgentHubRequestAlert,
  AgentHubThreadAlert
} from './agent-hub-alerts'
import {
  botThreadAlertDecision,
  readAgentHubBotAlertSettings,
  type AgentHubBotThreadStatus
} from './agent-hub-bot-alert-policy'
import { readAgentHubBotIdentity } from './agent-hub-bot-identity-read'
import { findAgentHubChatTab } from './agent-hub-chat-tabs'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

function threadStatus(alert: AgentHubThreadAlert): AgentHubBotThreadStatus {
  if (alert.kind !== 'done') {
    return 'ask'
  }
  return activityThreadStatusId(alert.thread) === 'failed' ? 'failed' : 'done'
}

/** The Orb window shows this chat on screen, which is as good as the chat tab being open. */
function orbShowsSession(session: string | null): boolean {
  const panel = useAgentHubOrbPanel.getState()
  return session !== null && panel.chatVisible && panel.session?.sessionId === session
}

/**
 * Splits agent alerts into those of plain agents and bubbles of bots, once and upstream: whatever
 * belongs to a bot's chat or worker leaves the agent path, whether or not it ends up shown.
 */
export function routeThreadAlertsToBots(alerts: readonly AgentHubThreadAlert[]): {
  agents: AgentHubThreadAlert[]
  bots: AgentHubBotAlert[]
} {
  const agents: AgentHubThreadAlert[] = []
  const bots: AgentHubBotAlert[] = []
  const settings = readAgentHubBotAlertSettings()
  const state = useAppStore.getState()
  for (const alert of alerts) {
    const identity = readAgentHubBotIdentity({
      worktree: alert.thread.worktree,
      tab: alert.thread.tab
    })
    if (!identity) {
      agents.push(alert)
      continue
    }
    const origin =
      identity.origin === 'worker' ? 'worker' : identity.origin === 'home' ? 'home' : 'side'
    const session = findAgentHubChatTab(state, alert.thread.tab.id)?.entityId ?? null
    const status = threadStatus(alert)
    const decision = botThreadAlertDecision({
      bot: identity.bot,
      origin,
      status,
      homeChatVisible: orbShowsSession(session),
      settings
    })
    if (decision === 'drop') {
      continue
    }
    const botKey = botRefKey(identity.bot)
    bots.push({
      id: `bot:${botKey}:${alert.id}`,
      kind: status === 'ask' ? 'ask' : status === 'failed' ? 'failure' : 'done',
      bot: {
        bot: identity.bot,
        botKey,
        at: Date.now(),
        subject: { type: 'thread', alert, origin, session }
      }
    })
  }
  return { agents, bots }
}

/** Requests are keyed by environment id, bots by execution host id. */
export function requestHostId(host: string): string {
  return host === 'local' ? LOCAL_EXECUTION_HOST_ID : toRuntimeExecutionHostId(host)
}

/** The same for requests: a caller with a bot id raises the bot's bubble, not an agent's. */
export function routeRequestAlertsToBots(alerts: readonly AgentHubRequestAlert[]): {
  agents: AgentHubRequestAlert[]
  bots: AgentHubBotAlert[]
} {
  const agents: AgentHubRequestAlert[] = []
  const bots: AgentHubBotAlert[] = []
  if (!readBotsEnabled()) {
    return { agents: [...alerts], bots }
  }
  const settings = readAgentHubBotAlertSettings()
  const known = readBots()
  for (const alert of alerts) {
    const { botId } = alert.request.caller
    const hostId = requestHostId(alert.host)
    const bot = botId ? known.find((entry) => entry.id === botId && entry.hostId === hostId) : null
    if (!bot) {
      agents.push(alert)
      continue
    }
    const status: AgentHubBotThreadStatus =
      alert.kind === 'ask' || alert.kind === 'approval' ? 'ask' : 'done'
    if (
      botThreadAlertDecision({ bot, origin: 'side', status, homeChatVisible: false, settings }) ===
      'drop'
    ) {
      continue
    }
    const botKey = botRefKey(bot)
    bots.push({
      id: `bot:${botKey}:${alert.id}`,
      kind: status === 'ask' ? 'ask' : 'done',
      bot: { bot, botKey, at: Date.now(), subject: { type: 'request', alert } }
    })
  }
  return { agents, bots }
}
