import { describe, expect, it } from 'vitest'
import { PANE_KEY, PANE_KEY_2, PANE_KEY_3 } from './agent-hub-activity-test-fixtures'
import { agentHubCounts, buildAgentHubLists } from './agent-hub-lists'
import { agentHubThreadsFor as threadsFor } from './agent-hub-test-fixtures'

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
    expect(agentHubCounts(lists)).toEqual({
      needsYou: 1,
      working: 1,
      finished: 1,
      nestedWorking: 0
    })
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

    expect(agentHubCounts(lists)).toEqual({
      needsYou: 0,
      working: 0,
      finished: 0,
      nestedWorking: 0
    })
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

  it('drops finished agents older than the clear-after window', () => {
    const threads = threadsFor([
      { paneKey: PANE_KEY, state: 'done', at: 1_000 },
      { paneKey: PANE_KEY_2, state: 'done', at: 50_000 }
    ])
    const lists = buildAgentHubLists(threads, { now: 61_000, finishedMaxAgeMs: 30_000 })

    expect(lists.finished.map((thread) => thread.paneKey)).toEqual([PANE_KEY_2])
  })

  it('holds an approval as working through its grace period, then asks the user', () => {
    const approval = JSON.stringify({ approval: { tool: 'Bash', summary: 'git status' } })
    const threads = threadsFor([
      { paneKey: PANE_KEY, state: 'waiting', at: 1_000, interactivePrompt: approval },
      { paneKey: PANE_KEY_2, state: 'waiting', at: 1_000 }
    ])

    const early = buildAgentHubLists(threads, { now: 5_000, approvalGraceMs: 8_000 })
    expect(early.needsYou.map((thread) => thread.paneKey)).toEqual([PANE_KEY_2])
    expect(early.working.map((thread) => thread.paneKey)).toEqual([PANE_KEY])
    expect(early.approvalGraceEndsAt).toBe(9_000)

    const late = buildAgentHubLists(threads, { now: 9_500, approvalGraceMs: 8_000 })
    expect(late.needsYou.map((thread) => thread.paneKey).sort()).toEqual([PANE_KEY, PANE_KEY_2])
    expect(late.approvalGraceEndsAt).toBeNull()
  })
})
