import type { AgentChatPermissionMode } from '../../../shared/agent-launch/permissions/agent-chat-permission-mode'
import type { AgentHubOrbSession } from '../../../shared/agent-hub-orb'
import {
  AGENT_HUB_ORB_PI_PERMISSION_REASON,
  agentHubOrbSupportsAsk,
  type normalizeAgentHubOrbSettings
} from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import type { Bot } from '../../../shared/bot-types'
import { folderWorkspaceKey } from '../../../shared/workspace/identity/workspace-scope'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { AgentHubLedger } from '../../runtime/agent-hub/agent-hub-ledger'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import { agentHubOrbPermissionMode } from './agent-hub-orb-permission-settings'
import { requireIdleAgentHubOrbSession } from './agent-hub-orb-settings-transition'
import { releaseAgentHubOrbOperations } from './agent-hub-orb-session-close'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'

type OrbSettings = ReturnType<typeof normalizeAgentHubOrbSettings>

/** The Orb bot and its Home chat, as the session manager drives them. */
export type AgentHubOrbBotChats = {
  find: () => Bot | null
  /** Makes the bot on first use and syncs it with the Orb settings. */
  ensure: () => Promise<Bot>
  ensureChat: (botId: string) => Promise<string>
  resetChat: (botId: string) => Promise<string>
  closeChat: (sessionId: string) => Promise<{ stopped: boolean; reason?: string }>
}

/** The Orb bot's Home chat while its tab exists. */
export function agentHubOrbBotSession(
  host: StructuredAgentSessionHost | null | undefined,
  bot: Bot
): AgentHubOrbSession | null {
  const tabId = host && bot.chatSessionId ? host.getSessionTabId(bot.chatSessionId) : null
  return bot.chatSessionId && tabId
    ? {
        sessionId: bot.chatSessionId,
        tabId,
        resumed: false,
        workspaceId: folderWorkspaceKey(bot.folderWorkspaceId)
      }
    : null
}

/** Opens the Orb bot's Home chat, starting a new one when the chosen model or permission changed:
 *  a running chat keeps the ones it started with. */
export async function openAgentHubOrbBotSession(input: {
  host: StructuredAgentSessionHost
  hub: Pick<AgentHubLedger, 'snapshot'>
  chats: AgentHubOrbBotChats
  rawSettings: AgentHubSettings
  settings: OrbSettings
  previous: OrbSettings | null
  resumeSessionId?: string | undefined
}): Promise<{ session: AgentHubOrbSession; mode: AgentChatPermissionMode | null }> {
  const { host, chats, settings, previous } = input
  const before = chats.find()
  if (input.resumeSessionId && input.resumeSessionId !== before?.chatSessionId) {
    throw new AgentHubError('not_found', 'Orb conversation was not found on this host')
  }
  const record = before?.chatSessionId ? host.deps.store.getRecord(before.chatSessionId) : null
  const changed =
    previous !== null &&
    (previous.agent !== settings.agent ||
      previous.model !== settings.model ||
      previous.permission !== settings.permission)
  if (record && changed) {
    await requireIdleAgentHubOrbSession(host, input.hub, record.sessionId)
  }
  const bot = await chats.ensure()
  if (settings.permission === 'ask' && !agentHubOrbSupportsAsk(bot.agent)) {
    throw new AgentHubError('invalid_argument', AGENT_HUB_ORB_PI_PERMISSION_REASON)
  }
  const mode = agentHubOrbPermissionMode(input.rawSettings, bot.agent)
  const stale =
    record !== null &&
    record.provider === bot.agent &&
    (changed || (mode !== null && record.permissionMode !== mode))
  const sessionId = stale ? await chats.resetChat(bot.id) : await chats.ensureChat(bot.id)
  const tabId = host.getSessionTabId(sessionId)
  return {
    session: {
      sessionId,
      ...(tabId ? { tabId } : {}),
      resumed: false,
      workspaceId: folderWorkspaceKey(bot.folderWorkspaceId)
    },
    mode
  }
}

/** The Orb bot keeps one Home chat; older floating chats stay in the Bots history. */
export function agentHubOrbBotRecords(
  host: StructuredAgentSessionHost,
  bot: Bot
): AgentSessionRecord[] {
  const home = bot.chatSessionId ? host.deps.store.getRecord(bot.chatSessionId) : null
  return home ? [home] : []
}

/** Stops the Home chat (its history stays) and frees the operations it held. */
export async function closeAgentHubOrbBotChat(
  runtime: object,
  chats: AgentHubOrbBotChats,
  sessionId: string
): Promise<void> {
  const closed = await chats.closeChat(sessionId)
  if (!closed.stopped) {
    throw new AgentHubError('invalid_argument', 'Orb conversation could not be closed')
  }
  releaseAgentHubOrbOperations(runtime, sessionId)
}
