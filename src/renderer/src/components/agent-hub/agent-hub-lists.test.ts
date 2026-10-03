import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { buildActivityEvents } from '../activity/activity-event-builder'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree,
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3
} from '../activity/ActivityPrototypePage-test-fixtures'
import { agentHubCounts, buildAgentHubLists } from './agent-hub-lists'

type Fixture = {
  paneKey: string
  state: AgentStatusEntry['state']
  at: number
  acknowledgedAt?: number
}

function threadsFor(fixtures: Fixture[]): AgentPaneThread[] {
  const repo = makeRepo()
  const worktree = makeWorktree()
  const tabs = fixtures.map((_fixture, index) => makeTabWithIds(`tab-${index + 1}`, worktree.id))
  const now = Math.max(...fixtures.map((fixture) => fixture.at))
  return makeThreads(
    buildActivityEvents({
      agentStatusByPaneKey: Object.fromEntries(
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
            agentType: 'claude'
          } satisfies AgentStatusEntry
        ])
      ),
      retainedAgentsByPaneKey: {},
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

describe('buildAgentHubLists', () => {
  it('sorts agents into needs-you, working and unread finished', () => {
    const lists = buildAgentHubLists(
      threadsFor([
        { paneKey: PANE_KEY, state: 'waiting', at: 1_000 },
        { paneKey: PANE_KEY_2, state: 'working', at: 2_000 },
        { paneKey: PANE_KEY_3, state: 'done', at: 3_000 }
      ])
    )

    expect(lists.needsYou.map((thread) => thread.paneKey)).toEqual([PANE_KEY])
    expect(lists.working.map((thread) => thread.paneKey)).toEqual([PANE_KEY_2])
    expect(lists.finished.map((thread) => thread.paneKey)).toEqual([PANE_KEY_3])
    expect(agentHubCounts(lists)).toEqual({ needsYou: 1, working: 1, finished: 1 })
  })

  it('treats a blocked agent as needing the user', () => {
    const lists = buildAgentHubLists(
      threadsFor([{ paneKey: PANE_KEY, state: 'blocked', at: 1_000 }])
    )

    expect(lists.needsYou.map((thread) => thread.paneKey)).toEqual([PANE_KEY])
  })

  it('drops a finished agent once the user has seen it', () => {
    const lists = buildAgentHubLists(
      threadsFor([{ paneKey: PANE_KEY, state: 'done', at: 1_000, acknowledgedAt: 2_000 }])
    )

    expect(agentHubCounts(lists)).toEqual({ needsYou: 0, working: 0, finished: 0 })
  })

  it('puts the longest-waiting question first and the newest result first', () => {
    const waiting = buildAgentHubLists(
      threadsFor([
        { paneKey: PANE_KEY, state: 'waiting', at: 5_000 },
        { paneKey: PANE_KEY_2, state: 'waiting', at: 1_000 }
      ])
    )
    expect(waiting.needsYou.map((thread) => thread.paneKey)).toEqual([PANE_KEY_2, PANE_KEY])

    const finished = buildAgentHubLists(
      threadsFor([
        { paneKey: PANE_KEY, state: 'done', at: 1_000 },
        { paneKey: PANE_KEY_2, state: 'done', at: 5_000 }
      ])
    )
    expect(finished.finished.map((thread) => thread.paneKey)).toEqual([PANE_KEY_2, PANE_KEY])
  })
})
