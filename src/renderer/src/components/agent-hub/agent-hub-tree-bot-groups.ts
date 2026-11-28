import { botRefKey } from '@/lib/bot-hosts'
import { AGENT_HUB_SLEEPING_GROUP } from './agent-hub-sleeping-groups'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { Bot } from '../../../../shared/bot-types'
import {
  AGENT_HUB_BOTS_GROUP,
  type AgentHubGroupNode,
  type AgentHubTerminalRow,
  type AgentHubWorkspaceNode
} from './agent-hub-terminal-tree'

export type AgentHubBotChatTally = { key: string; bot: Bot; chats: number }

/** The groups without the bots' chats, and those chats' group (which the build put last). */
export function splitAgentHubBotChats(groups: readonly AgentHubGroupNode[]): {
  rest: AgentHubGroupNode[]
  botGroup: AgentHubGroupNode | null
} {
  return {
    rest: groups.filter((group) => group.key !== AGENT_HUB_BOTS_GROUP),
    botGroup: groups.find((group) => group.key === AGENT_HUB_BOTS_GROUP) ?? null
  }
}

/** How many chats each bot has open, in the order the tree lists them. */
export function tallyAgentHubBotChats(botGroup: AgentHubGroupNode | null): AgentHubBotChatTally[] {
  const tally = new Map<string, AgentHubBotChatTally>()
  for (const workspace of botGroup?.workspaces ?? []) {
    if (!workspace.bot) {
      continue
    }
    const key = botRefKey(workspace.bot.bot)
    const entry = tally.get(key) ?? { key, bot: workspace.bot.bot, chats: 0 }
    entry.chats += workspace.rows.length
    tally.set(key, entry)
  }
  return [...tally.values()]
}

/**
 * Folds each workspace's idle agents behind a count; `openKeys` are the workspaces whose fold was
 * opened by hand. An idle agent with workers listed under it stays, so a working worker is never hidden.
 */
export function foldAgentHubIdleRows(
  groups: readonly AgentHubGroupNode[],
  openKeys: ReadonlySet<string>,
  isIdle: (row: AgentHubTerminalRow) => boolean
): AgentHubGroupNode[] {
  return groups.map((group) =>
    group.key === AGENT_HUB_SLEEPING_GROUP || group.key === AGENT_HUB_BOTS_GROUP
      ? group
      : {
          ...group,
          workspaces: group.workspaces.map((workspace): AgentHubWorkspaceNode => {
            const idle = new Set(
              workspace.rows.filter((row) => row.children.length === 0 && isIdle(row))
            )
            if (idle.size === 0) {
              return workspace
            }
            const open = openKeys.has(workspace.key)
            return {
              ...workspace,
              rows: open ? workspace.rows : workspace.rows.filter((row) => !idle.has(row)),
              idleFold: { count: idle.size, open, rows: [...idle] }
            }
          })
        }
  )
}

/** An agent that is open but quiet; shells never fold. */
export function agentHubRowIsIdleAgent(row: AgentHubTerminalRow): boolean {
  return row.thread ? agentHubIndicatorKind(row.thread) === 'idle' : row.idleAgent !== null
}
