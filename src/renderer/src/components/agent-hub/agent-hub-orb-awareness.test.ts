import { expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { PANE_KEY, PANE_KEY_2 } from './agent-hub-activity-test-fixtures'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { buildAgentHubLists } from './agent-hub-lists'
import { collectAgentHubOrbAwareness } from './agent-hub-orb-awareness'
import { reduceAgentHubRequests, type AgentHubRequestsState } from './agent-hub-requests-store'

it('includes all current agents and their real question choices without a selected-agent list', () => {
  const threads = agentHubThreadsFor([
    {
      paneKey: PANE_KEY,
      state: 'waiting',
      at: 1_000,
      interactivePrompt: JSON.stringify({
        questions: [
          { question: 'Which layout?', options: [{ label: 'Compact' }, { label: 'Wide' }] }
        ]
      })
    },
    { paneKey: PANE_KEY_2, state: 'working', at: 2_000 }
  ]).map((thread) => ({ ...thread, worktree: { ...thread.worktree, hostId: 'local' as const } }))
  const result = collectAgentHubOrbAwareness({
    state: useAppStore.getState(),
    threads,
    lists: buildAgentHubLists(threads),
    requests: new Map(),
    remoteLimits: new Map(),
    now: 3_000
  })
  expect(result.snapshot.totalAgents).toBe(2)
  expect(result.snapshot.agents.map((agent) => agent.state).sort()).toEqual(['waiting', 'working'])
  expect(result.snapshot.notices).toHaveLength(1)
  expect(result.snapshot.notices[0]?.text).toContain('Which layout?')
  expect(result.snapshot.notices[0]?.text).toContain('1. Compact')
  expect(result.snapshot.notices[0]?.text).toContain('2. Wide')
  expect(result.display.get(result.snapshot.notices[0]?.id ?? '')).toEqual({
    kind: 'question',
    question: 'Which layout?',
    options: 2
  })
})

it('keeps equal request and pane IDs on two hosts separate, drops expired requests and excludes Orb itself', () => {
  const threads = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1_000 }])
  const local = threads[0]!
  const remote = {
    ...local,
    worktree: {
      ...local.worktree,
      hostId: 'runtime:peer' as const,
      runtimeOwnerEnvironmentId: 'peer'
    }
  }
  const base = {
    requestId: '11111111-1111-4111-8111-111111111111',
    caller: { paneKey: PANE_KEY, terminalHandle: 'same-handle' },
    target: { paneKey: PANE_KEY, terminalHandle: 'same-handle' },
    createdAt: 1_000,
    expiresAt: 5_000
  }
  let requests: AgentHubRequestsState = new Map()
  for (const host of ['local', 'peer']) {
    requests = reduceAgentHubRequests(requests, host, {
      ...base,
      kind: 'ask',
      question: `${host} question`,
      options: ['A', 'B'],
      multi: false
    })
  }
  const all = [local, remote]
  const input = {
    state: useAppStore.getState(),
    threads: all,
    lists: buildAgentHubLists(all),
    requests,
    remoteLimits: new Map(),
    now: 3_000
  }
  const result = collectAgentHubOrbAwareness(input)
  expect(result.snapshot.notices.map((notice) => notice.host).sort()).toEqual(['local', 'peer'])
  expect(new Set(result.snapshot.notices.map((notice) => notice.id)).size).toBe(2)
  expect(collectAgentHubOrbAwareness({ ...input, now: 6_000 }).snapshot.notices).toEqual([])
  expect(
    collectAgentHubOrbAwareness({ ...input, orbTabId: local.tab.id }).snapshot.totalAgents
  ).toBe(0)
})

it('preserves unverifiable work instead of turning lost evidence into a finished or stalled agent', () => {
  const threads = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1_000 }])
  const thread = { ...threads[0]!, currentAgentState: null }
  const result = collectAgentHubOrbAwareness({
    state: useAppStore.getState(),
    threads: [thread],
    lists: buildAgentHubLists([thread]),
    requests: new Map(),
    remoteLimits: new Map(),
    now: 600_000
  })
  expect(result.snapshot.agents[0]?.state).toBe('unverifiable')
  expect(result.snapshot.notices).toEqual([])
})

it('classifies a needs-you notify as an info update, not a decision', () => {
  const threads = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1_000 }])
  const requests = reduceAgentHubRequests(new Map(), 'local', {
    requestId: '22222222-2222-4222-8222-222222222222',
    caller: { paneKey: PANE_KEY, terminalHandle: 'same-handle' },
    target: { paneKey: PANE_KEY, terminalHandle: 'same-handle' },
    createdAt: 1_000,
    expiresAt: 5_000,
    kind: 'notify',
    level: 'needs-you',
    sound: false,
    links: [],
    text: 'TEST-3: Dikkat bildirimi denemesi'
  })
  const { snapshot, display } = collectAgentHubOrbAwareness({
    state: useAppStore.getState(),
    threads,
    lists: buildAgentHubLists(threads),
    requests,
    remoteLimits: new Map(),
    now: 3_000
  })
  expect(snapshot.notices).toHaveLength(1)
  expect(snapshot.notices[0]?.kind).toBe('info')
  expect(snapshot.notices[0]?.text).toContain('TEST-3')
  expect(display.get(snapshot.notices[0]?.id ?? '')).toEqual({
    kind: 'update',
    text: 'TEST-3: Dikkat bildirimi denemesi'
  })
})
