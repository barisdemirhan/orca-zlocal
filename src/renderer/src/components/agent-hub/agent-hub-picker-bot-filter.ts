import { botRefKey } from '@/lib/bot-hosts'
import type { Bot } from '../../../../shared/bot-types'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { filterAgentHubTerminalTreeRows } from './agent-hub-terminal-tree-view'

export type AgentHubPickerBot = {
  key: string
  bot: Bot
  /** Picker rows in the bot's home or in workspaces it opened. */
  count: number
}

/** Every bot with a row in the tree, with its row count. */
export function agentHubPickerBots(groups: readonly AgentHubGroupNode[]): AgentHubPickerBot[] {
  const bots = new Map<string, AgentHubPickerBot>()
  const visit = (row: AgentHubTerminalRow): void => {
    if (row.bot) {
      const key = botRefKey(row.bot.bot)
      const entry = bots.get(key)
      if (entry) {
        entry.count += 1
      } else {
        bots.set(key, { key, bot: row.bot.bot, count: 1 })
      }
    }
    row.children.forEach(visit)
  }
  for (const group of groups) {
    for (const workspace of group.workspaces) {
      workspace.rows.forEach(visit)
    }
  }
  return [...bots.values()].sort((a, b) => a.bot.name.localeCompare(b.bot.name))
}

/** An empty selection means no filter. */
export function filterAgentHubTreeByBots(
  groups: readonly AgentHubGroupNode[],
  keys: ReadonlySet<string>
): AgentHubGroupNode[] {
  return keys.size === 0
    ? [...groups]
    : filterAgentHubTerminalTreeRows(
        groups,
        (row) => row.bot !== undefined && keys.has(botRefKey(row.bot.bot))
      )
}
