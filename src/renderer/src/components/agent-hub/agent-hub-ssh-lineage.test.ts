import { expect, it } from 'vitest'
import { buildChildAgentLineageTree } from '../activity/threads/activity-thread-child-agent'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { projectResolvedWorktreeLineage } from '../../../../shared/worktree/lineage/resolved-worktree-lineage'
import type { WorktreeLineage } from '../../../../shared/worktree/lineage-types'
import { PANE_KEY, PANE_KEY_2 } from './agent-hub-activity-test-fixtures'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'

function sshThreads(withParent: boolean): AgentPaneThread[] {
  const threads = agentHubThreadsFor([
    { paneKey: PANE_KEY, state: 'working', at: 1_000 },
    { paneKey: PANE_KEY_2, state: 'working', at: 1_000 }
  ])
  return threads.map((thread, index) => ({
    ...thread,
    worktree: {
      ...thread.worktree,
      id: index === 0 ? 'parent-worktree' : 'worker-worktree',
      instanceId: index === 0 ? 'parent-instance' : 'worker-instance',
      hostId: 'ssh:workhost'
    },
    currentAgentEntry: thread.currentAgentEntry
      ? {
          ...thread.currentAgentEntry,
          terminalHandle: index === 0 ? 'term-parent' : 'term-worker',
          ...(withParent && index === 1
            ? {
                orchestration: {
                  taskId: 'task-worker',
                  dispatchId: 'dispatch-worker',
                  parentTerminalHandle: 'term-parent'
                }
              }
            : {})
        }
      : null
  }))
}

it('shows SSH workers from separate worktrees when pane orchestration reaches the renderer', () => {
  const threads = sshThreads(true)
  const hub = buildAgentHubLineage(threads, 1_000)
  const activity = buildChildAgentLineageTree(threads)
  expect(hub.parentOf.get(PANE_KEY_2)).toBe(PANE_KEY)
  expect(activity.childPaneKeys.has(PANE_KEY_2)).toBe(true)
  expect(agentHubMirrorFamily(PANE_KEY, threads, hub)?.tree[0]?.thread.paneKey).toBe(PANE_KEY_2)
})

it('distinguishes sidebar worktree children from agent-pane dispatch lineage', () => {
  const threads = sshThreads(false)
  const lineage: WorktreeLineage = {
    worktreeId: 'worker-worktree',
    worktreeInstanceId: 'worker-instance',
    parentWorktreeId: 'parent-worktree',
    parentWorktreeInstanceId: 'parent-instance',
    origin: 'orchestration',
    capture: { source: 'orchestration-context', confidence: 'explicit' },
    coordinatorHandle: 'term-parent',
    createdAt: 1_000
  }
  const projected = projectResolvedWorktreeLineage(
    threads.map((thread) => thread.worktree),
    { [lineage.worktreeId]: lineage }
  )
  expect(projected[0].childWorktreeIds).toEqual(['worker-worktree'])
  expect(buildChildAgentLineageTree(threads).childPaneKeys.size).toBe(0)
  expect(agentHubMirrorFamily(PANE_KEY, threads, buildAgentHubLineage(threads, 1_000))).toBeNull()
})
