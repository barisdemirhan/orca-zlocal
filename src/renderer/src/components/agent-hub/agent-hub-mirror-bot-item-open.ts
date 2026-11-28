import { openBotItemOnSurface } from '../bots/items/bot-item-open'
import type { Bot } from '../../../../shared/bot-types'
import { openAgentHubMirrorDrawer } from './agent-hub-mirror-drawer-store'
import { agentHubMirrorBotSurface, setAgentHubMirrorBotTab } from './agent-hub-mirror-bot-tab-store'

/** Opens a task in the mirror window's Activity tab, opening its drawer first so the panel is there. */
export function openBotItemInMirror(
  destination: { windowId: string; sourceKey: string },
  bot: Bot,
  uid: string
): void {
  setAgentHubMirrorBotTab(destination.windowId, 'activity')
  openAgentHubMirrorDrawer(destination.sourceKey, 'settings', 'user')
  openBotItemOnSurface(bot, uid, agentHubMirrorBotSurface(destination.windowId))
}
