import { acceptedAgentStatuses } from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentSubagentSnapshot } from '../../../../shared/agent-status/contracts/agent-status-subagent-snapshot'
import { buildActivityEvents } from '../activity/events/activity-event-builder'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree
} from './agent-hub-activity-test-fixtures'

export type AgentHubThreadFixture = {
  paneKey: string
  state: AgentStatusEntry['state']
  at: number
  acknowledgedAt?: number
  interactivePrompt?: string
  /** Makes this pane an orchestration worker of that pane. */
  parentPaneKey?: string
  spawnedByPaneKey?: string
  subagents?: AgentSubagentSnapshot[]
}

/** Threads built by the real Activity pipeline, one tab per fixture (tab-1, tab-2, …). */
export function agentHubThreadsFor(fixtures: AgentHubThreadFixture[]): AgentPaneThread[] {
  const repo = makeRepo()
  const worktree = makeWorktree()
  const tabs = fixtures.map((_fixture, index) => makeTabWithIds(`tab-${index + 1}`, worktree.id))
  const now = Math.max(...fixtures.map((fixture) => fixture.at))
  return makeThreads(
    buildActivityEvents({
      chatNames: new Map(),
      agentStatusByPaneKey: acceptedAgentStatuses(
        fixtures.map((fixture) => [
          fixture.paneKey,
          {
            state: fixture.state,
            prompt: 'Prompt',
            updatedAt: fixture.at,
            stateStartedAt: fixture.at,
            paneKey: fixture.paneKey,
            terminalTitle: 'Claude',
            stateHistory: [],
            agentType: 'claude',
            ...(fixture.interactivePrompt ? { interactivePrompt: fixture.interactivePrompt } : {}),
            ...(fixture.parentPaneKey
              ? {
                  orchestration: {
                    taskId: `task-${fixture.paneKey}`,
                    dispatchId: `dispatch-${fixture.paneKey}`,
                    parentPaneKey: fixture.parentPaneKey
                  }
                }
              : {}),
            ...(fixture.spawnedByPaneKey
              ? { spawnedBy: { paneKey: fixture.spawnedByPaneKey } }
              : {}),
            ...(fixture.subagents ? { subagents: fixture.subagents } : {})
          } satisfies AgentStatusEntry
        ])
      ),
      tabsByWorktree: { [worktree.id]: tabs },
      worktreeMap: new Map([[worktree.id, worktree]]),
      repoMap: new Map([[repo.id, repo]]),
      acknowledgedAgentsByPaneKey: Object.fromEntries(
        fixtures
          .filter((fixture) => fixture.acknowledgedAt !== undefined)
          .map((fixture) => [fixture.paneKey, fixture.acknowledgedAt ?? 0])
      ),
      now
    })
  )
}
