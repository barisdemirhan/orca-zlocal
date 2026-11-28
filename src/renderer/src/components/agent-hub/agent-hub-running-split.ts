import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubRowBot } from './agent-hub-terminal-tree'

type BotOfWorktree = (worktree: AgentPaneThread['worktree']) => AgentHubRowBot | null

/** Working threads split into agents and bots' own, each keeping its order; one split feeds both the rows and the keyboard. */
export function splitAgentHubRunningByBot(
  working: readonly AgentPaneThread[],
  botOf: BotOfWorktree | undefined
): { agents: AgentPaneThread[]; bots: AgentPaneThread[] } {
  const agents: AgentPaneThread[] = []
  const bots: AgentPaneThread[] = []
  for (const thread of working) {
    ;(botOf?.(thread.worktree) ? bots : agents).push(thread)
  }
  return { agents, bots }
}

/** One group per project in the order each first appears, so the longest-running stays on top. */
export function groupAgentHubRunningByProject(
  agents: readonly AgentPaneThread[]
): { key: string; threads: AgentPaneThread[] }[] {
  const groups = new Map<string, AgentPaneThread[]>()
  for (const thread of agents) {
    const key = thread.worktree.repoId
    groups.set(key, [...(groups.get(key) ?? []), thread])
  }
  return [...groups].map(([key, threads]) => ({ key, threads }))
}

/** The top-level Running threads in the order they are listed: projects, then bots. */
export function orderAgentHubRunningThreads(
  working: readonly AgentPaneThread[],
  botOf: BotOfWorktree | undefined
): AgentPaneThread[] {
  const { agents, bots } = splitAgentHubRunningByBot(working, botOf)
  return [...groupAgentHubRunningByProject(agents).flatMap((group) => group.threads), ...bots]
}
