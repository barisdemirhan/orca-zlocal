import { describe, expect, it } from 'vitest'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import {
  LEAF_ID_UNKNOWN,
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3
} from '../activity/ActivityPrototypePage-test-fixtures'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'
import { agentHubThreadsFor as threadsFor } from './agent-hub-test-fixtures'

// tab-4 matches the fourth fixture's tab.
const PANE_KEY_4 = makePaneKey('tab-4', LEAF_ID_UNKNOWN)

// Dispatcher (1) → workers (2, 4); worker 2 → its own worker (3).
const threads = threadsFor([
  { paneKey: PANE_KEY, state: 'working', at: 1_000 },
  { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY },
  { paneKey: PANE_KEY_3, state: 'working', at: 1_000, parentPaneKey: PANE_KEY_2 },
  { paneKey: PANE_KEY_4, state: 'done', at: 1_000, parentPaneKey: PANE_KEY }
])
const lineage = buildAgentHubLineage(threads, 1_000)

function describeFamily(paneKey: string): { path: string[]; members: string[] } | null {
  const family = agentHubMirrorFamily(paneKey, threads, lineage)
  return (
    family && {
      path: family.path.map((thread) => thread.paneKey),
      members: family.members.map(
        (member) => `${member.thread.paneKey}${member.childCount ? ` +${member.childCount}` : ''}`
      )
    }
  )
}

describe('agentHubMirrorFamily', () => {
  it("lists a dispatcher's workers, marking the one that dispatched workers of its own", () => {
    expect(describeFamily(PANE_KEY)).toEqual({
      path: [PANE_KEY],
      members: [`${PANE_KEY_2} +1`, PANE_KEY_4]
    })
  })

  it('shows a worker beside its siblings, under its dispatcher', () => {
    expect(describeFamily(PANE_KEY_4)?.path).toEqual([PANE_KEY])
  })

  it('goes a level deeper for a worker with workers, and keeps the way back up', () => {
    expect(describeFamily(PANE_KEY_2)).toEqual({
      path: [PANE_KEY, PANE_KEY_2],
      members: [PANE_KEY_3]
    })
    expect(describeFamily(PANE_KEY_3)).toEqual({
      path: [PANE_KEY, PANE_KEY_2],
      members: [PANE_KEY_3]
    })
  })

  it('has no family for an agent that neither dispatched nor was dispatched', () => {
    const lone = threadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1_000 }])
    expect(agentHubMirrorFamily(PANE_KEY, lone, buildAgentHubLineage(lone, 1_000))).toBeNull()
  })
})
