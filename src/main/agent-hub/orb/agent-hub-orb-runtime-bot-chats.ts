import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import { closeBotSession, runtimeBotChats } from '../../bots/bot-chat-session'
import { readBotChatTree, runtimeBotChatTreeHost } from '../../bots/bot-chat-tree-host'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { botShareCreateDeps } from '../../runtime/rpc/methods/bots-share-create-deps'
import { ensureAgentHubOrbBot, findAgentHubOrbBot } from './agent-hub-orb-bot'
import type { AgentHubOrbBotChats } from './agent-hub-orb-bot-session'

// The runtime layer that owns the Orb is only part of the service, which the bots' chat wiring takes whole.
function isRuntimeService(runtime: object): runtime is OrcaRuntimeService {
  return 'bots' in runtime && 'botShares' in runtime && 'createAutomation' in runtime
}

/** The Orb bot and its Home chat, wired to the runtime's bots once the runtime is built. */
export function runtimeAgentHubOrbBotChats(
  host: object,
  getSettings: () => AgentHubSettings
): AgentHubOrbBotChats {
  const runtime = (): OrcaRuntimeService => {
    if (!isRuntimeService(host)) {
      throw new Error('The Orb bot needs the Orca runtime')
    }
    return host
  }
  return {
    find: () => findAgentHubOrbBot(runtime().bots.list()),
    ensure: () =>
      ensureAgentHubOrbBot({
        bots: runtime().bots,
        createDeps: () => botShareCreateDeps(runtime()),
        getSettings
      }),
    ensureChat: (botId) => runtimeBotChats(runtime()).ensure(botId),
    resetChat: (botId) => runtimeBotChats(runtime()).reset(botId),
    closeChat: (sessionId) => closeBotSession(runtime(), sessionId),
    earlierChats: async (bot) =>
      (await readBotChatTree(runtimeBotChatTreeHost(runtime()), { botId: bot.id })).chats
        // The tree lists an empty side chat only while its tab is open; without a preview it is empty.
        .filter((chat) => chat.origin === 'side' && chat.preview !== undefined)
        .map((chat) => chat.liveSessionId ?? chat.chatId)
  }
}
