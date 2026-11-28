import { describe, expect, it } from 'vitest'
import { PANE_KEY, PANE_KEY_2 } from './agent-hub-activity-test-fixtures'
import {
  agentHubAlertBaseline,
  diffAgentHubAlerts,
  orcaNotificationWillSound
} from './agent-hub-alerts'
import { buildAgentHubLists } from './agent-hub-lists'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'

const both = { onNeedsInput: true, onFinished: true }
const approval = JSON.stringify({ approval: { tool: 'Bash', summary: 'git rebase origin/main' } })

describe('diffAgentHubAlerts', () => {
  it('alerts once when an agent starts asking or finishes, not for what was already there', () => {
    const before = buildAgentHubLists(
      agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'waiting', at: 1_000 }])
    )
    const after = buildAgentHubLists(
      agentHubThreadsFor([
        { paneKey: PANE_KEY, state: 'waiting', at: 1_000 },
        { paneKey: PANE_KEY_2, state: 'done', at: 2_000 }
      ])
    )

    const first = diffAgentHubAlerts(agentHubAlertBaseline(before), after, both)
    expect(first.fresh.map((alert) => [alert.thread.paneKey, alert.kind])).toEqual([
      [PANE_KEY_2, 'done']
    ])
    expect(diffAgentHubAlerts(first.baseline, after, both).fresh).toEqual([])
  })

  it('alerts again when the same agent asks a new question', () => {
    const first = buildAgentHubLists(
      agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'waiting', at: 1_000 }])
    )
    const second = buildAgentHubLists(
      agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'waiting', at: 5_000 }])
    )

    expect(diffAgentHubAlerts(agentHubAlertBaseline(first), second, both).fresh).toHaveLength(1)
  })

  it('tells approvals from questions and honours the per-event switches', () => {
    const lists = buildAgentHubLists(
      agentHubThreadsFor([
        { paneKey: PANE_KEY, state: 'waiting', at: 1_000, interactivePrompt: approval },
        { paneKey: PANE_KEY_2, state: 'done', at: 2_000 }
      ])
    )

    expect(diffAgentHubAlerts(new Set(), lists, both).fresh.map((alert) => alert.kind)).toEqual([
      'approval',
      'done'
    ])
    expect(
      diffAgentHubAlerts(new Set(), lists, { onNeedsInput: false, onFinished: true }).fresh.map(
        (alert) => alert.kind
      )
    ).toEqual(['done'])
  })
})

describe('worker results', () => {
  it("raise a mirror-only alert instead of joining the Inbox's finished list", () => {
    const threads = agentHubThreadsFor([
      { paneKey: PANE_KEY, state: 'working', at: 1_000 },
      { paneKey: PANE_KEY_2, state: 'done', at: 2_000, parentPaneKey: PANE_KEY }
    ])
    const lists = buildAgentHubLists(threads, { parentOf: new Map([[PANE_KEY_2, PANE_KEY]]) })
    const { fresh } = diffAgentHubAlerts(new Set(), lists, both)

    expect(lists.finished).toEqual([])
    expect(fresh).toMatchObject([{ kind: 'done', mirrorOnly: true }])
  })
})

describe('orcaNotificationWillSound', () => {
  const base = {
    windowFocused: true,
    activeWorktreeId: 'wt-1',
    worktreeId: 'wt-1',
    nativeBannerRefused: false
  }

  it("defers to Orca's banner unless Orca suppresses it for the focused, active worktree", () => {
    expect(orcaNotificationWillSound({ ...base, notifications: {} })).toBe(false)
    expect(orcaNotificationWillSound({ ...base, notifications: {}, worktreeId: 'wt-2' })).toBe(true)
    expect(orcaNotificationWillSound({ ...base, notifications: {}, windowFocused: false })).toBe(
      true
    )
  })

  it('treats disabled notifications as silent', () => {
    expect(
      orcaNotificationWillSound({ ...base, worktreeId: 'wt-2', notifications: { enabled: false } })
    ).toBe(false)
    expect(
      orcaNotificationWillSound({
        ...base,
        worktreeId: 'wt-2',
        notifications: { agentTaskComplete: false }
      })
    ).toBe(false)
  })

  it('treats a banner the OS refused as silent', () => {
    expect(
      orcaNotificationWillSound({
        ...base,
        worktreeId: 'wt-2',
        notifications: {},
        nativeBannerRefused: true
      })
    ).toBe(false)
  })
})
