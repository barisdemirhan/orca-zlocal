import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
import { describe, expect, it } from 'vitest'
import {
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3,
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import { buildChildAgentLineageTree } from '../activity/activity-thread-child-agent'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { buildAgentHubLists } from './agent-hub-lists'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../../../shared/agent-session/view/structured-agent-session-projection'
import { buildActivityEvents } from '../activity/activity-event-builder'

describe('CLI-started agents in Hub', () => {
  it('folds the host-recorded public structured worker pane into its caller family', () => {
    const sessionId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    const workerPane = structuredAgentSessionPaneKey(
      structuredAgentSessionTabId(sessionId),
      sessionId
    )
    const worktree = makeWorktree()
    const common = {
      state: 'working',
      prompt: 'work',
      updatedAt: 1000,
      stateStartedAt: 1000
    } as const
    const threads = makeThreads(
      buildActivityEvents({
        chatNames: new Map(),
        agentStatusByPaneKey: acceptedAgentStatuses(
          Object.entries({
            [PANE_KEY]: { ...common, stateHistory: [], paneKey: PANE_KEY, agentType: 'claude' },
            [workerPane]: {
              ...common,
              stateHistory: [],
              paneKey: workerPane,
              worktreeId: worktree.id,
              agentType: 'codex',
              orchestration: { taskId: 'task-worker', dispatchId: 'ctx-worker' },
              spawnedBy: { paneKey: PANE_KEY }
            }
          })
        ),
        tabsByWorktree: { [worktree.id]: [makeTabWithIds('tab-1', worktree.id)] },
        worktreeMap: new Map([[worktree.id, worktree]]),
        repoMap: new Map([['repo-1', makeRepo()]]),
        acknowledgedAgentsByPaneKey: {},
        now: 1000
      })
    )
    const lineage = buildAgentHubLineage(threads, 1000)
    expect(agentHubMirrorFamily(PANE_KEY, threads, lineage)?.tree[0]?.thread.paneKey).toBe(
      workerPane
    )
    expect(
      buildAgentHubLists(threads, { parentOf: lineage.parentOf }).working.map(
        (thread) => thread.paneKey
      )
    ).toEqual([PANE_KEY])
  })

  it('folds a spawned chain and lists it in the mirror family without classifying orchestration workers elsewhere', () => {
    const threads = agentHubThreadsFor([
      { paneKey: PANE_KEY, state: 'working', at: 1000 },
      { paneKey: PANE_KEY_2, state: 'working', at: 1000, spawnedByPaneKey: PANE_KEY },
      { paneKey: PANE_KEY_3, state: 'working', at: 1000, spawnedByPaneKey: PANE_KEY_2 }
    ])
    const lineage = buildAgentHubLineage(threads, 1000)
    expect(lineage.parentOf.get(PANE_KEY_2)).toBe(PANE_KEY)
    expect(lineage.parentOf.get(PANE_KEY_3)).toBe(PANE_KEY_2)
    expect(
      buildAgentHubLists(threads, { parentOf: lineage.parentOf }).working.map((t) => t.paneKey)
    ).toEqual([PANE_KEY])
    const family = agentHubMirrorFamily(PANE_KEY, threads, lineage)
    expect(family?.tree[0]?.thread.paneKey).toBe(PANE_KEY_2)
    expect(family?.tree[0]?.children[0]?.thread.paneKey).toBe(PANE_KEY_3)
    expect(buildChildAgentLineageTree(threads).childPaneKeys.size).toBe(0)
    const remaining = threads.filter((thread) => thread.paneKey !== PANE_KEY)
    const orphaned = buildAgentHubLineage(remaining, 1000)
    expect(orphaned.parentOf.has(PANE_KEY_2)).toBe(false)
    expect(
      buildAgentHubLists(remaining, { parentOf: orphaned.parentOf }).working.map((t) => t.paneKey)
    ).toEqual([PANE_KEY_2])
  })

  it('prefers orchestration and never resurrects a pruned creator link from old activity', () => {
    const threads = agentHubThreadsFor([
      { paneKey: PANE_KEY, state: 'working', at: 1000 },
      { paneKey: PANE_KEY_2, state: 'working', at: 1000 },
      {
        paneKey: PANE_KEY_3,
        state: 'working',
        at: 1000,
        spawnedByPaneKey: PANE_KEY,
        parentPaneKey: PANE_KEY_2
      }
    ])
    expect(buildAgentHubLineage(threads, 1000).parentOf.get(PANE_KEY_3)).toBe(PANE_KEY_2)
    expect(
      buildAgentHubLineage(
        threads.filter((thread) => thread.paneKey !== PANE_KEY_2),
        1000
      ).parentOf.has(PANE_KEY_3)
    ).toBe(false)
    const child = threads[2]
    const historical = child.latestEvent?.entry
    if (!historical) {
      throw new Error('Missing activity entry')
    }
    const pruned = { ...historical, orchestration: undefined, spawnedBy: undefined }
    expect(
      buildAgentHubLineage(
        [
          ...threads.slice(0, 2),
          {
            ...child,
            currentAgentEntry: pruned,
            paneEntry: pruned,
            latestEvent: null,
            events: child.events.map((event) => ({
              ...event,
              entry: { ...historical, orchestration: undefined }
            }))
          }
        ],
        1000
      ).parentOf.has(PANE_KEY_3)
    ).toBe(false)
  })
})
